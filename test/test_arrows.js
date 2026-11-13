// Tests of src/arrows.js. Run: node test/test_arrows.js (last line "N/N passed").
const A = require('../src/arrows.js');

// atoms: [id, element, charge, implicit H]; bonds: [a, b, order], bond id "a-b".
function mol(atoms, bonds) {
  return {
    atoms: atoms.map(([id, el, q, h]) => ({ id, el, q: q || 0, h: h || 0 })),
    bonds: bonds.map(([a, b, order]) => ({ id: a + '-' + b, a, b, order: order || 1 })),
  };
}
const lp = (atom) => ({ kind: 'lp', atom });
const bond = (id) => ({ kind: 'bond', bond: id });
const atom = (id, via) => (via ? { kind: 'atom', atom: id, via } : { kind: 'atom', atom: id });
const pair = (a, b) => ({ kind: 'pair', a, b });
const q = (s, id) => s.atoms.find((x) => x.id === id).q;
const order = (s, a, b) => {
  const bd = s.bonds.find((x) => (x.a === a && x.b === b) || (x.a === b && x.b === a));
  return bd ? bd.order : 0;
};
const codes = (r) => r.errors.map((e) => e.code).join(',');

let pass = 0;
let total = 0;
function test(name, fn) {
  total += 1;
  try {
    fn();
    pass += 1;
  } catch (e) {
    console.log('FAIL ' + name + ': ' + e.message);
  }
}
function eq(got, want, what) {
  if (got !== want) throw new Error((what || 'value') + ': got ' + got + ', expected ' + want);
}
function okResult(scene, arrows) {
  const r = A.apply(scene, arrows);
  if (!r.ok) throw new Error('rejected: ' + codes(r));
  eq(A.totalCharge(r.scene), A.totalCharge(scene), 'total charge');
  return r.scene;
}

const meBr = () => mol([['O1', 'O', -1, 1], ['C2', 'C', 0, 3], ['Br3', 'Br']], [['C2', 'Br3']]);

test('substitution at sp3 carbon (hydroxide, bromomethane)', () => {
  const s = okResult(meBr(), [
    { from: lp('O1'), to: atom('C2') },
    { from: bond('C2-Br3'), to: atom('Br3') },
  ]);
  eq(q(s, 'O1'), 0); eq(q(s, 'Br3'), -1); eq(q(s, 'C2'), 0);
  eq(order(s, 'O1', 'C2'), 1); eq(order(s, 'C2', 'Br3'), 0);
  eq(A.toSmiles(s), '[OH][CH3].[Br-]');
});

test('arrow to a full-octet carbon without a broken bond is rejected', () => {
  const r = A.apply(meBr(), [{ from: lp('O1'), to: atom('C2') }]);
  eq(r.ok, false); eq(codes(r), 'octet');
});

test('addition to a carbonyl (cyanide, formaldehyde)', () => {
  const s0 = mol([['C1', 'C', 0, 2], ['O2', 'O'], ['C3', 'C', -1], ['N4', 'N']], [['C1', 'O2', 2], ['C3', 'N4', 3]]);
  const s = okResult(s0, [
    { from: lp('C3'), to: atom('C1') },
    { from: bond('C1-O2'), to: atom('O2') },
  ]);
  eq(q(s, 'O2'), -1); eq(q(s, 'C3'), 0); eq(order(s, 'C1', 'O2'), 1); eq(order(s, 'C3', 'C1'), 1);
});

test('elimination with a drawn hydrogen (bond to adjacent bond)', () => {
  const s0 = mol(
    [['O1', 'O', -1, 1], ['H2', 'H'], ['C3', 'C', 0, 2], ['C4', 'C', 0, 2], ['Br5', 'Br']],
    [['H2', 'C3'], ['C3', 'C4'], ['C4', 'Br5']]
  );
  const s = okResult(s0, [
    { from: lp('O1'), to: atom('H2') },
    { from: bond('H2-C3'), to: bond('C3-C4') },
    { from: bond('C4-Br5'), to: atom('Br5') },
  ]);
  eq(order(s, 'O1', 'H2'), 1); eq(order(s, 'H2', 'C3'), 0); eq(order(s, 'C3', 'C4'), 2);
  eq(q(s, 'Br5'), -1); eq(q(s, 'O1'), 0); eq(q(s, 'H2'), 0); eq(q(s, 'C3'), 0); eq(q(s, 'C4'), 0);
});

test('proton transfer needs both arrows (hydrogen duet)', () => {
  const s0 = mol([['O1', 'O', -1, 1], ['H2', 'H'], ['O3', 'O', 0, 1]], [['H2', 'O3']]);
  const r = A.apply(s0, [{ from: lp('O1'), to: atom('H2') }]);
  eq(codes(r), 'octet');
  const s = okResult(s0, [{ from: lp('O1'), to: atom('H2') }, { from: bond('H2-O3'), to: atom('O3') }]);
  eq(q(s, 'O1'), 0); eq(q(s, 'O3'), -1);
});

const tBuBr = () => mol(
  [['C1', 'C'], ['Ca', 'C', 0, 3], ['Cb', 'C', 0, 3], ['Cc', 'C', 0, 3], ['Br', 'Br']],
  [['C1', 'Ca'], ['C1', 'Cb'], ['C1', 'Cc'], ['C1', 'Br']]
);

test('heterolysis gives a cation with a vacant orbital', () => {
  const s = okResult(tBuBr(), [{ from: bond('C1-Br'), to: atom('Br') }]);
  eq(q(s, 'C1'), 1); eq(q(s, 'Br'), -1);
  eq(A.isVacant(s, 'C1'), true); eq(A.isVacant(s, 'Ca'), false);
});

test('lone pair to a vacant atom (water, tert-butyl cation)', () => {
  const cat = A.apply(tBuBr(), [{ from: bond('C1-Br'), to: atom('Br') }]).scene;
  cat.atoms.push({ id: 'Ow', el: 'O', q: 0, h: 2 });
  const s = okResult(cat, [{ from: lp('Ow'), to: atom('C1') }]);
  eq(q(s, 'Ow'), 1); eq(q(s, 'C1'), 0); eq(order(s, 'Ow', 'C1'), 1);
});

const etheneHBr = () => mol([['C1', 'C', 0, 2], ['C2', 'C', 0, 2], ['H3', 'H'], ['Br4', 'Br']], [['C1', 'C2', 2], ['H3', 'Br4']]);

test('bond to a distant atom is ambiguous without "via"', () => {
  const r = A.apply(etheneHBr(), [{ from: bond('C1-C2'), to: atom('H3') }, { from: bond('H3-Br4'), to: atom('Br4') }]);
  eq(codes(r), 'ambiguous');
  eq(r.errors[0].options.join(','), 'C1,C2');
});

test('alkene protonation with "via"', () => {
  const s = okResult(etheneHBr(), [
    { from: bond('C1-C2'), to: atom('H3', 'C1') },
    { from: bond('H3-Br4'), to: atom('Br4') },
  ]);
  eq(order(s, 'C1', 'H3'), 1); eq(order(s, 'C1', 'C2'), 1); eq(q(s, 'C2'), 1); eq(q(s, 'C1'), 0); eq(q(s, 'Br4'), -1);
});

test('enolate alkylation (lone pair to own bond, bond to atom pair)', () => {
  const s0 = mol(
    [['O1', 'O', -1], ['C2', 'C', 0, 1], ['C3', 'C', 0, 2], ['C4', 'C', 0, 3], ['I5', 'I']],
    [['O1', 'C2'], ['C2', 'C3', 2], ['C4', 'I5']]
  );
  const s = okResult(s0, [
    { from: lp('O1'), to: bond('O1-C2') },
    { from: bond('C2-C3'), to: pair('C3', 'C4') },
    { from: bond('C4-I5'), to: atom('I5') },
  ]);
  eq(order(s, 'O1', 'C2'), 2); eq(order(s, 'C2', 'C3'), 1); eq(order(s, 'C3', 'C4'), 1); eq(order(s, 'C4', 'I5'), 0);
  eq(q(s, 'O1'), 0); eq(q(s, 'C2'), 0); eq(q(s, 'C3'), 0); eq(q(s, 'C4'), 0); eq(q(s, 'I5'), -1);
});

test('iminium formation from a protonated hemiaminal', () => {
  const s0 = mol([['N1', 'N', 0, 2], ['C2', 'C', 0, 2], ['O3', 'O', 1, 2]], [['N1', 'C2'], ['C2', 'O3']]);
  const s = okResult(s0, [{ from: lp('N1'), to: bond('N1-C2') }, { from: bond('C2-O3'), to: atom('O3') }]);
  eq(A.toSmiles(s), '[NH2+]=[CH2].[OH2]');
});

test('ammonium nitrogen has no lone pair', () => {
  const s0 = mol([['N1', 'N', 1, 4], ['C2', 'C', 1, 3]], []);
  eq(A.lonePairs(s0, 'N1'), 0);
  const r = A.apply(s0, [{ from: lp('N1'), to: atom('C2') }]);
  eq(r.ok, false);
  if (!codes(r).includes('no-lone-pair')) throw new Error('codes: ' + codes(r));
});

test('one lone pair cannot start two arrows beyond its count', () => {
  const s0 = mol([['N1', 'N', 0, 3], ['Ba', 'B', 0, 3], ['Bb', 'B', 0, 3]], []);
  const r = A.apply(s0, [{ from: lp('N1'), to: atom('Ba') }, { from: lp('N1'), to: atom('Bb') }]);
  if (!codes(r).includes('no-lone-pair')) throw new Error('codes: ' + codes(r));
  const s = okResult(s0, [{ from: lp('N1'), to: atom('Ba') }]);
  eq(q(s, 'N1'), 1); eq(q(s, 'Ba'), -1);
});

test('bond to a bond that is not adjacent is rejected', () => {
  const s0 = mol([['C1', 'C', 0, 2], ['C2', 'C', 0, 2], ['C3', 'C', 0, 2], ['C4', 'C', 0, 2]], [['C1', 'C2', 2], ['C3', 'C4', 2]]);
  eq(codes(A.apply(s0, [{ from: bond('C1-C2'), to: bond('C3-C4') }])), 'sink-not-adjacent');
});

test('single bond cannot start two arrows', () => {
  const r = A.apply(meBr(), [{ from: bond('C2-Br3'), to: atom('Br3') }, { from: bond('C2-Br3'), to: atom('Br3') }]);
  if (!codes(r).includes('bond-order')) throw new Error('codes: ' + codes(r));
});

test('unknown ids and malformed arrows are reported', () => {
  eq(codes(A.apply(meBr(), [{ from: lp('X'), to: atom('C2') }])), 'unknown-atom');
  eq(codes(A.apply(meBr(), [{ from: bond('nope'), to: atom('C2') }])), 'unknown-bond');
  eq(codes(A.apply(meBr(), [{ from: { kind: 'ink' }, to: atom('C2') }])), 'bad-source');
  eq(codes(A.apply(meBr(), [{ from: lp('O1'), to: {} }])), 'bad-sink');
});

test('drawn hydrogen from an implicit one', () => {
  const r = A.explicitH(meBr(), 'C2');
  eq(r.scene.atoms.find((x) => x.id === 'C2').h, 2);
  eq(order(r.scene, 'C2', r.atom), 1);
  eq(A.explicitH(meBr(), 'Br3'), null);
});

test('the input scene is not modified', () => {
  const s0 = meBr();
  const before = JSON.stringify(s0);
  A.apply(s0, [{ from: lp('O1'), to: atom('C2') }, { from: bond('C2-Br3'), to: atom('Br3') }]);
  eq(JSON.stringify(s0), before);
});

test('ring closure in SMILES output (cyclohexene)', () => {
  const ids = ['a', 'b', 'c', 'd', 'e', 'f'];
  const s0 = mol(
    ids.map((id, i) => [id, 'C', 0, i < 2 ? 1 : 2]),
    ids.map((id, i) => [id, ids[(i + 1) % 6], i === 0 ? 2 : 1])
  );
  eq(A.toSmiles(s0), '[CH]1=[CH][CH2][CH2][CH2][CH2]1');
});

console.log(pass + '/' + total + ' passed');
process.exit(pass === total ? 0 : 1);
