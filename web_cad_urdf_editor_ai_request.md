# Web簡易CAD/URDFエディタ AI依頼書

## 目的

Webブラウザ上で簡易的な機構モデルを作成し、PyBullet等で読み込めるURDF一式を出力するアプリを作成する。

本アプリは本格CADやFEM解析ツールではなく、以下を目的とする。

- 解析用の単純形状を作る
- リンクと関節をGUIで定義する
- 質量・重心・慣性を設定する
- 表示用のmeshを必要に応じて割り当てる
- URDFとmesh一式を出力する
- PyBulletで検証しやすいpreview scriptを生成する

## 基本方針

解析形状と表示形状を分ける。

```text
解析形状:
  box / cylinder / sphere
  接触判定・質量・慣性・動力学解析に使う

表示形状:
  STL / OBJ / 生成mesh
  見た目、動画、確認用に使う
```

URDFでは以下のように出力する。

```xml
<visual>
  <geometry>
    <mesh filename="meshes/visual/arm.stl"/>
  </geometry>
</visual>

<collision>
  <geometry>
    <box size="0.4 0.08 0.08"/>
  </geometry>
</collision>
```

## MVP機能

### 1. 形状作成

以下のプリミティブ形状を作成できること。

- box
- cylinder
- sphere

各形状は以下を編集できること。

- name
- position
- rotation
- scaleまたは寸法
- color
- linkへの所属
- visual用かcollision用か

### 2. 表示用mesh

以下を扱えること。

- STL import
- OBJ import
- アプリ内で作成したプリミティブからmesh生成
- visual meshとしてlinkへ割り当て
- collision shapeとは独立して管理

MVPではmeshのboolean編集、粘土編集、STEP importは対象外でよい。

### 3. Link定義

linkごとに以下を編集できること。

- link name
- visual geometry
- collision geometry
- mass
- center of mass
- inertia tensor
- material/color

linkはRobot tree上で一覧できること。

### 4. Joint定義

jointごとに以下を編集できること。

- joint name
- joint type
  - fixed
  - revolute
  - continuous
  - prismatic
- parent link
- child link
- origin xyz
- origin rpy
- axis xyz
- limit lower/upper/effort/velocity
- dynamics damping/friction

joint axisは3Dビュー上に矢印で表示すること。

### 5. Mass/Inertia設定

MVPでは以下の2方式を用意する。

1. 手入力
2. プリミティブ形状からの簡易自動計算

boxの慣性:

```text
Ixx = 1/12 * m * (y^2 + z^2)
Iyy = 1/12 * m * (x^2 + z^2)
Izz = 1/12 * m * (x^2 + y^2)
```

sphereの慣性:

```text
Ixx = Iyy = Izz = 2/5 * m * r^2
```

cylinderの慣性は、URDF/PyBulletでの円柱軸をz軸とする。

```text
Ixx = Iyy = 1/12 * m * (3r^2 + h^2)
Izz = 1/2 * m * r^2
```

単位はm、kg、radで統一する。

### 6. URDF出力

以下を出力できること。

```text
robot_package.zip
  robot.urdf
  meshes/
    visual/
      *.stl
      *.obj
    collision/
      *.stl
      *.obj
  preview_pybullet.py
  robot_model.json
  validation_report.json
```

URDF XMLはDOM APIまたはXMLライブラリで生成し、文字列連結で生成しない。

mesh pathはURDFからの相対パスにする。

### 7. PyBullet preview script

`preview_pybullet.py`を生成すること。

内容:

- `pybullet.GUI`で接続
- planeを読み込み
- `robot.urdf`を読み込み
- gravityを設定
- joint sliderを作成
- link/joint情報をprint
- load失敗時にエラーを表示

## 推奨技術構成

```text
Frontend:
  React
  TypeScript
  Three.js
  React Three Fiber
  Drei / TransformControls
  Zustand

Geometry:
  Three.js primitives
  STLLoader
  OBJLoader
  STLExporter
  OBJExporter

Export:
  JSZip
  XMLSerializer / DOMParser

Optional:
  Monaco Editor for URDF XML preview
```

## UI構成

```text
左:
  Robot tree
  - links
  - joints
  - meshes

中央:
  Three.js 3D viewport
  - visual表示
  - collision表示
  - joint axis表示
  - center of mass表示

右:
  Property editor
  - selected link
  - selected joint
  - selected shape

下:
  Validation panel
  - errors
  - warnings
  - export readiness
```

必要な操作:

- add link
- add box
- add cylinder
- add sphere
- import STL/OBJ
- assign selected shape to visual
- assign selected shape to collision
- create joint between two links
- export URDF package
- save/load project JSON

## 内部データモデル案

```ts
type Vec3 = [number, number, number];

type Pose = {
  xyz: Vec3;
  rpy: Vec3;
};

type GeometrySpec =
  | { type: "box"; size: Vec3 }
  | { type: "sphere"; radius: number }
  | { type: "cylinder"; radius: number; length: number }
  | { type: "mesh"; filename: string; scale: Vec3 };

type InertialSpec = {
  origin: Pose;
  mass: number;
  inertia: {
    ixx: number;
    ixy: number;
    ixz: number;
    iyy: number;
    iyz: number;
    izz: number;
  };
};

type LinkSpec = {
  id: string;
  name: string;
  visual?: GeometrySpec;
  collision?: GeometrySpec;
  inertial: InertialSpec;
};

type JointSpec = {
  id: string;
  name: string;
  type: "fixed" | "revolute" | "continuous" | "prismatic";
  parent: string;
  child: string;
  origin: Pose;
  axis: Vec3;
  limit?: {
    lower: number;
    upper: number;
    effort: number;
    velocity: number;
  };
  dynamics?: {
    damping: number;
    friction: number;
  };
};

type RobotModel = {
  name: string;
  unit: "m";
  links: LinkSpec[];
  joints: JointSpec[];
};
```

## Validation要件

URDF出力前に以下を検証する。

- robot nameがある
- link nameが重複していない
- joint nameが重複していない
- root linkが1つだけ
- joint parent/childが存在する
- parentとchildが同じでない
- link graphにcycleがない
- disconnected linkがない
- fixed以外のjoint axisがゼロでない
- revolute/prismaticにlimitがある
- massが正の値
- inertiaが正の値
- mesh file pathが存在する
- collision geometryが設定されている
- 単位がmで統一されている

warning:

- visual meshとcollision meshが同一
- collisionに高密度meshを使用
- inertial originがlink中心から大きく離れている
- joint limitが極端に大きい

## 対象外

MVPでは以下は対象外。

- STEP/IGES import
- 本格パラメトリックCAD
- 履歴ベースCAD
- boolean modeling
- 粘土 sculpting
- FEM mesh生成
- 応力解析
- SDF/MJCF出力
- ROS2 control出力
- 閉ループ機構の完全対応
- 自動VHACD

## 受け入れ条件

以下ができればMVP完了とする。

1. Web画面でbox/cylinder/sphereを作成できる。
2. 2つ以上のlinkを作成できる。
3. link間にrevolute jointを設定できる。
4. mass/inertiaを手入力または自動計算できる。
5. visualとcollisionを別々に設定できる。
6. STL/OBJをvisual meshとして読み込める。
7. URDFを生成できる。
8. zip packageをダウンロードできる。
9. 生成されたURDFをPyBulletの`loadURDF()`で読み込める。
10. validation errorが画面に表示される。

## AIへの依頼文

```text
Webブラウザ上で動作する簡易CAD/URDFエディタを作成してください。

目的は、PyBulletで解析するためのURDFモデルをGUIで作成することです。
本格CADではなく、box/cylinder/sphereを中心にした解析用プリミティブ形状と、STL/OBJなどの表示用meshを分離して扱います。

必須機能:
- Three.jsで3D viewportを表示
- box/cylinder/sphereの作成、移動、回転、寸法編集
- linkの作成と編集
- jointの作成と編集
- joint typeはfixed/revolute/continuous/prismatic
- mass、center of mass、inertia tensorの入力
- プリミティブ形状からの簡易慣性計算
- STL/OBJ importをvisual meshとして設定
- collision geometryはbox/cylinder/sphereを基本にする
- URDF XML出力
- robot.urdf、meshes、preview_pybullet.py、robot_model.json、validation_report.jsonをzip出力
- validation panelでエラーと警告を表示

技術:
- React + TypeScript
- Three.jsまたはReact Three Fiber
- Zustand
- JSZip
- XMLはDOM APIまたはXMLSerializerで生成

設計:
- Three.js sceneを正とせず、RobotModel JSONを正とする
- sceneはRobotModelの表示結果として構築する
- visual geometryとcollision geometryを必ず分ける
- 単位はm/kg/radで統一する
- URDFのmesh pathは相対パスにする

対象外:
- STEP/IGES import
- 本格CAD
- boolean
- sculpting
- FEM
- 応力解析
- SDF/MJCF

成果物:
- 実行可能なWebアプリ
- README
- サンプルrobot project
- PyBullet preview script
- 生成URDFのサンプル
```
