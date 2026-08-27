import json,os
HERE=os.path.dirname(os.path.abspath(__file__))
from collections import defaultdict
d=json.load(open(os.path.join(HERE,'puzzles_raw.json')))
SIZES={'A':4,'B':5,'C':5,'D':5,'E':5,'F':3,'G':5,'H':5,'I':5,'J':4,'K':4,'L':5}
def norm(cells):
    r0=min(r for r,c in cells); c0=min(c for r,c in cells)
    return frozenset((r-r0,c-c0) for r,c in cells)
def variants(cells):
    out=set(); cur=set(cells)
    for flip in range(2):
        s=set((r,-c) for r,c in cur) if flip else set(cur)
        for rot in range(4):
            s=set((c,-r) for r,c in s)
            out.add(norm(s))
    return out
found=defaultdict(set)
for n,rows in d['2d'].items():
    pos=defaultdict(list)
    for r,row in enumerate(rows):
        for c,ch in enumerate(row):
            if ch!='.': pos[ch].append((r,c))
    for L,p in pos.items():
        if len(p)==SIZES[L]:
            found[L].add(frozenset(norm(p)))
canon={}
for L in sorted(SIZES):
    vs=set()
    for s in found[L]:
        vs |= variants(s)
    key=min(tuple(sorted(v)) for v in vs)
    canon[L]=key
    h=max(r for r,c in key)+1; w=max(c for r,c in key)+1
    grid=[['.']*w for _ in range(h)]
    for r,c in key: grid[r][c]=L
    print(L, len(vs), f'{h}x{w}')
    for row in grid: print('   ',''.join(row))
json.dump({k:[list(x) for x in v] for k,v in canon.items()}, open(os.path.join(HERE,'shapes.json'),'w'))
