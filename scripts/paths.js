// Helper for relative paths from repo root
import path from "path";

export const repoRoot = () => path.resolve(process.cwd());

export const fromRoot = (...p) => path.resolve(repoRoot(), ...p); 