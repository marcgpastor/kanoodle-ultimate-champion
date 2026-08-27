/* El resolutor, en un fil a part: els reptes més costosos triguen un parell de
   segons la primera vegada i no volem que la pàgina es quedi encallada. */
importScripts('solver.js');

self.onmessage = e => {
  const { id, grid, dim, shapes, sizes } = e.data;
  let res = null;
  try { res = KanoodleSolver.solve(grid, dim, shapes, sizes); } catch (err) { res = null; }
  self.postMessage({ id, res: res && res.ok ? res : null });
};
