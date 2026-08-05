/**
 * One copyright line for every footer. The year is read at render time so it
 * never has to be remembered on January 1.
 */
export function SiteCopyright() {
  return <span>© {new Date().getFullYear()} Tuveloz. All rights reserved.</span>;
}
