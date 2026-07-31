declare module 'mmd-parser' {
  const MMDParser: any;
  export default MMDParser;
  export function parsePmx(buffer: ArrayBuffer): any;
  export function parseVmd(buffer: ArrayBuffer): any;
}
