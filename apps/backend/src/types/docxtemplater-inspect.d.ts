declare module "docxtemplater/js/inspect-module.js" {
  interface InspectModuleInstance {
    /** Tag tree of the parsed template: loops carry their children as nested objects. */
    getAllTags(): Record<string, Record<string, unknown>>;
  }
  /** Factory as used with `modules: [InspectModule()]`. */
  export default function InspectModule(): InspectModuleInstance & Record<string, unknown>;
}
