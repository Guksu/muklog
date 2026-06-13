// __mocks__/react-native-svg.js
// react-native-svg 모킹 (testing-strategy: 외부 SDK/네이티브 = 모킹·스모크).
//   네이티브 SVG 파서를 거치지 않고 testID/접근성 props를 그대로 통과시키는 경량 View 스텁.
//   실제 글리프 렌더는 디바이스/시뮬 스모크에서 확인한다.
const React = require('react');
const { View } = require('react-native');

const make = (name) => {
  const Comp = (props) => React.createElement(View, props, props.children);
  Comp.displayName = name;
  return Comp;
};

const Svg = make('Svg');
const SvgXml = make('SvgXml');

module.exports = {
  __esModule: true,
  default: Svg,
  Svg,
  SvgXml,
  Path: make('Path'),
  G: make('G'),
  Circle: make('Circle'),
  Rect: make('Rect'),
  Ellipse: make('Ellipse'),
  Defs: make('Defs'),
  LinearGradient: make('LinearGradient'),
  Stop: make('Stop'),
};
