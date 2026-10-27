import "@testing-library/jest-dom/jest-globals";
import { TextDecoder, TextEncoder } from "node:util";

// React Router and other web APIs may need these in the jsdom environment.
Object.assign(globalThis, { TextEncoder, TextDecoder });
