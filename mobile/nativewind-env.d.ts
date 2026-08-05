/// <reference types="nativewind/types" />

// The root layout imports `global.css` for its side effect (it is what pulls
// the compiled Tailwind output into the bundle). TypeScript needs to be told
// that a stylesheet is a legitimate import target.
declare module '*.css';
