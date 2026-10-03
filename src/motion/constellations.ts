/**
 * A few real constellations, as star positions and the lines that join them,
 * for the star field to place among its loose stars. Coordinates are in an
 * arbitrary box of `w` by `h`. Positions are simplified, but the figures are
 * the ones people know: Orion's hourglass and belt, the Big Dipper's bowl and
 * handle, the W of Cassiopeia, the Southern Cross (seen from Indonesia),
 * Scorpius with its curling tail and Cygnus as the Northern Cross.
 */
export interface Constellation {
  name: string;
  w: number;
  h: number;
  stars: Array<[number, number]>;
  edges: Array<[number, number]>;
}

export const constellations: Constellation[] = [
  {
    name: 'Orion',
    w: 60,
    h: 100,
    stars: [[30, 0], [10, 14], [52, 16], [22, 50], [31, 48], [40, 46], [14, 92], [56, 100]],
    edges: [[0, 1], [0, 2], [1, 3], [2, 5], [3, 4], [4, 5], [3, 6], [5, 7]],
  },
  {
    name: 'Big Dipper',
    w: 100,
    h: 55,
    stars: [[0, 20], [20, 25], [36, 22], [52, 28], [55, 52], [88, 55], [92, 30]],
    edges: [[0, 1], [1, 2], [2, 3], [3, 4], [4, 5], [5, 6], [6, 3]],
  },
  {
    name: 'Cassiopeia',
    w: 100,
    h: 40,
    stars: [[0, 12], [22, 36], [50, 18], [76, 38], [100, 6]],
    edges: [[0, 1], [1, 2], [2, 3], [3, 4]],
  },
  {
    name: 'Southern Cross',
    w: 50,
    h: 80,
    stars: [[24, 0], [26, 80], [0, 34], [50, 40]],
    edges: [[0, 1], [2, 3]],
  },
  {
    name: 'Scorpius',
    w: 100,
    h: 74,
    stars: [[14, 0], [22, 16], [8, 26], [30, 38], [42, 50], [54, 64], [68, 74], [84, 70], [94, 54], [98, 38]],
    edges: [[0, 1], [2, 1], [1, 3], [3, 4], [4, 5], [5, 6], [6, 7], [7, 8], [8, 9]],
  },
  {
    name: 'Cygnus',
    w: 70,
    h: 100,
    stars: [[35, 0], [35, 42], [35, 100], [0, 30], [70, 24]],
    edges: [[0, 1], [1, 2], [3, 1], [1, 4]],
  },
];
