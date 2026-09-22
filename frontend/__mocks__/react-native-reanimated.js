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

// Reanimated 4 shared values carry a get/set pair next to `.value`, and
// @gorhom/bottom-sheet reads them that way. Mirror the shape or the sheet
// throws while mounting.
function makeShared(initial) {
  const sv = {
    value: initial,
    get: () => sv.value,
    set: (next) => {
      sv.value = typeof next === "function" ? next(sv.value) : next;
    },
    modify: (fn) => {
      sv.value = fn ? fn(sv.value) : sv.value;
    },
    addListener: noop,
    removeListener: noop,
  };
  return sv;
}

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
  useEvent: (handler) => handler,
  useHandler: (handlers) => ({ context: {}, doDependenciesDiffer: false, useWeb: false, handlers }),
  // @gorhom/bottom-sheet calls these at import time; Reanimated 4 ships them as
  // no-ops, so the mock needs them too or the module throws on load.
  addWhitelistedUIProps: noop,
  addWhitelistedNativeProps: noop,
  isWorkletRuntime: () => false,
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

  useSharedValue: makeShared,
  makeMutable: makeShared,
  useAnimatedStyle: (fn) => {
    try {
      return fn();
    } catch {
      return {};
    }
  },
  useDerivedValue: (fn) => makeShared(fn()),
  useAnimatedScrollHandler: () => noop,
  useAnimatedRef: () => ({ current: null }),
  useEvent: (handler) => handler,
  useHandler: (handlers) => ({ context: {}, doDependenciesDiffer: false, useWeb: false, handlers }),
  useComposedEventHandler: (handlers) => handlers,
  useAnimatedReaction: noop,
  useAnimatedKeyboard: () => makeShared(0),
  useFrameCallback: () => ({ setActive: noop, isActive: false }),
  useWorkletCallback: (fn) => fn,
  useReducedMotion: () => false,
  useScrollViewOffset: () => makeShared(0),
  scrollTo: noop,
  measure: () => null,
  dispatchCommand: noop,
  createWorkletRuntime: () => ({}),
  ReduceMotion: { System: "system", Always: "always", Never: "never" },
  KeyboardState: { UNKNOWN: 0, OPENING: 1, OPEN: 2, CLOSING: 3, CLOSED: 4 },
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
