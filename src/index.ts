export function greeting(name: string): string {
  return `Hello, ${name}!`;
}

if (import.meta.main) {
  console.log(greeting('AI Engineering Squad'));
}
