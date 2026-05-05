export function getChartColors(theme: 'dark' | 'light') {
  return {
    grid: theme === 'dark' ? 'hsl(224, 45%, 22%)' : 'hsl(218, 22%, 92%)',
    axis: theme === 'dark' ? 'hsl(222, 27%, 69%)' : 'hsl(220, 9%, 46%)',
    orcado: theme === 'dark' ? 'hsl(222, 76%, 85%)' : 'hsl(230, 47%, 29%)',
    realizado: theme === 'dark' ? 'hsl(191, 100%, 50%)' : 'hsl(191, 100%, 41%)',
    positive: theme === 'dark' ? 'hsl(0, 91%, 71%)' : 'hsl(0, 73%, 50%)',
    negative: theme === 'dark' ? 'hsl(158, 64%, 52%)' : 'hsl(160, 84%, 39%)',
    warning: theme === 'dark' ? 'hsl(43, 96%, 56%)' : 'hsl(38, 92%, 50%)',
    reference: theme === 'dark' ? 'hsl(224, 45%, 30%)' : 'hsl(218, 22%, 80%)',
  };
}

// DFL palette: Cyan, Marine, Green, Amber, Purple, Red, Pink, Yellow, Teal
export const DONUT_COLORS_DARK = [
  'hsl(191, 100%, 50%)', 'hsl(222, 76%, 75%)', 'hsl(158, 64%, 52%)',
  'hsl(43, 96%, 56%)', 'hsl(262, 83%, 70%)', 'hsl(0, 91%, 71%)',
  'hsl(330, 81%, 65%)', 'hsl(48, 96%, 60%)', 'hsl(173, 80%, 50%)',
];

export const DONUT_COLORS_LIGHT = [
  'hsl(191, 100%, 41%)', 'hsl(230, 47%, 29%)', 'hsl(160, 84%, 39%)',
  'hsl(38, 92%, 50%)', 'hsl(262, 83%, 58%)', 'hsl(0, 73%, 50%)',
  'hsl(330, 81%, 50%)', 'hsl(48, 96%, 45%)', 'hsl(173, 80%, 40%)',
];
