// Hand-rolled Reanimated mock.
//
// Reanimated 4 splits the worklets runtime into a separate native module, and
// its own `mock` entry point still loads that native code, which Jest cannot
// run. The tests only care about what ends up on screen, so animated values
// resolve to their target immediately and animated components render as plain
// ones.
const React = require("react");
const { View, Text, ScrollView, FlatList, Image } = require("react-native");

const identity = (value) => value;
const noop = () => {};

function createAnimatedComponent(Component) {
  return React.forwardRef((props, ref) => React.createElement(Component, { ...props, ref }));
}

const Animated = {
  View: createAnimatedComponent(View),
  Text: createAnimatedComponent(Text),
  ScrollView: createAnimatedComponent(ScrollView),
  FlatList: createAnimatedComponent(FlatList),
  Image: createAnimatedComponent(Image),
  createAnimatedComponent,
  call: noop,
};

// Entering/exiting animation builders — every method returns the builder, so
// chains like FadeInDown.duration(260).springify() keep working.
function animationBuilder() {
  const builder = {};
  const chain = () => builder;
  [
    "duration",
    "delay",
    "springify",
    "damping",
    "stiffness",
    "mass",
    "easing",
    "withInitialValues",
    "randomDelay",
    "build",
    "reduceMotion",
  ].forEach((m) => {
    builder[m] = chain;
  });
  return builder;
}

const entering = new Proxy(
  {},
  {
    get: () => animationBuilder(),
  },
);

module.exports = {
  __esModule: true,
  default: Animated,
  ...Animated,

  useSharedValue: (initial) => ({ value: initial }),
  useAnimatedStyle: (fn) => {
    try {
      return fn();
    } catch {
      return {};
    }
  },
  useDerivedValue: (fn) => ({ value: fn() }),
  useAnimatedScrollHandler: () => noop,
  useAnimatedRef: () => ({ current: null }),
  useAnimatedProps: (fn) => {
    try {
      return fn();
    } catch {
      return {};
    }
  },

  withTiming: identity,
  withSpring: identity,
  withDelay: (_delay, value) => value,
  withRepeat: identity,
  withSequence: (...values) => values[values.length - 1],
  withDecay: identity,
  cancelAnimation: noop,
  runOnJS: (fn) => fn,
  runOnUI: (fn) => fn,

  interpolate: (_value, _input, output) => (Array.isArray(output) ? output[0] : 0),
  interpolateColor: (_value, _input, output) => (Array.isArray(output) ? output[0] : "#000000"),
  Extrapolation: { CLAMP: "clamp", EXTEND: "extend", IDENTITY: "identity" },
  Extrapolate: { CLAMP: "clamp", EXTEND: "extend", IDENTITY: "identity" },
  Easing: new Proxy(
    {},
    {
      get: () => {
        const fn = () => fn;
        return fn;
      },
    },
  ),

  FadeIn: entering.FadeIn,
  FadeOut: entering.FadeOut,
  FadeInDown: entering.FadeInDown,
  FadeInUp: entering.FadeInUp,
  FadeOutUp: entering.FadeOutUp,
  FadeOutDown: entering.FadeOutDown,
  SlideInRight: entering.SlideInRight,
  SlideOutLeft: entering.SlideOutLeft,
  ZoomIn: entering.ZoomIn,
  ZoomOut: entering.ZoomOut,
  Layout: animationBuilder(),
  LinearTransition: animationBuilder(),
};
