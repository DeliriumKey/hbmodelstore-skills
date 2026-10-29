import { prepareOption } from '../../../assets/charts/style.mjs';

// Keep business layouts, data and colors; share axes, grids and line styling.
export function researchOption(option, dark = false, width = 800) {
  return prepareOption(option, {
    dark, width, layout: 'preserve', dateLabels: 'preserve', barHover: 'native',
  }).option;
}
