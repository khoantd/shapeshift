/**
 * Stub for RN private VirtualViewNativeComponent.
 * Bun monorepo + Metro can crash babel on the real Flow/codegen file.
 * VirtualView is not used by Meanbox UI shell.
 */
const React = require("react");
const { View } = require("react-native");

function VirtualViewNativeComponent(props) {
  return React.createElement(View, props);
}

module.exports = VirtualViewNativeComponent;
