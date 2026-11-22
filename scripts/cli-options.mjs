export function option(name, fallback, argv = process.argv) {
  const index = argv.indexOf(`--${name}`);
  if (index >= 0) return argv[index + 1];
  return argv.find((arg) => arg.startsWith(`--${name}=`))?.slice(name.length + 3) ?? fallback;
}
