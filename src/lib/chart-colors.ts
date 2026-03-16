export function getChartColors(theme: 'dark' | 'light') {
  return {
    grid: theme === 'dark' ? 'hsl(220,20%,16%)' : 'hsl(220,15%,90%)',
    axis: theme === 'dark' ? 'hsl(215,15%,55%)' : 'hsl(215,15%,45%)',
    orcado: theme === 'dark' ? 'hsl(175,70%,45%)' : 'hsl(175,70%,38%)',
    realizado: theme === 'dark' ? 'hsl(210,80%,60%)' : 'hsl(210,80%,50%)',
    positive: theme === 'dark' ? 'hsl(0,72%,55%)' : 'hsl(0,72%,50%)',
    negative: theme === 'dark' ? 'hsl(152,60%,42%)' : 'hsl(152,60%,36%)',
    warning: theme === 'dark' ? 'hsl(38,92%,55%)' : 'hsl(38,92%,45%)',
    reference: theme === 'dark' ? 'hsl(220,20%,25%)' : 'hsl(220,15%,80%)',
  };
}

export const DONUT_COLORS_DARK = [
  'hsl(175, 70%, 45%)', 'hsl(210, 80%, 60%)', 'hsl(38, 92%, 55%)',
  'hsl(280, 60%, 55%)', 'hsl(152, 60%, 42%)', 'hsl(0, 72%, 55%)',
  'hsl(320, 60%, 50%)', 'hsl(45, 80%, 50%)', 'hsl(190, 70%, 50%)',
];

export const DONUT_COLORS_LIGHT = [
  'hsl(175, 70%, 38%)', 'hsl(210, 80%, 50%)', 'hsl(38, 92%, 45%)',
  'hsl(280, 60%, 45%)', 'hsl(152, 60%, 36%)', 'hsl(0, 72%, 50%)',
  'hsl(320, 60%, 42%)', 'hsl(45, 80%, 42%)', 'hsl(190, 70%, 42%)',
];
