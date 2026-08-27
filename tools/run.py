from extract import *
import json,sys,os

PAGES_2D=[6]+list(range(7,27))+[27]
PAGES_3D=[27]+list(range(28,48))+[48]

def do2d(p):
    balls,glyphs,boards=page_items(p)
    labs=labels(p)
    out={}
    for (bx0,by0,bx1,by1) in boards:
        inside=[b for b in balls if bx0<b[0]<bx1 and by0<b[1]<by1]
        assert len(inside)==55, (p,len(inside))
        rows=group_rows(inside,1,2.0)
        assert [len(r) for r in rows]==[11]*5, (p,[len(r) for r in rows])
        # nearest label above-left
        cand=[l for l in labs if l[2]<by0 and abs(l[1]-bx0)<20]
        cand.sort(key=lambda l: by0-l[2])
        n=cand[0][0]
        out[n]=[''.join(cells(r,glyphs)) for r in rows]
    return out

def do3d(p):
    balls,glyphs,boards=page_items(p)
    labs=labels(p)
    bd=[b for b in balls if not any(bx0<b[0]<bx1 and by0<b[1]<by1 for (bx0,by0,bx1,by1) in boards)]
    cl=[c for c in clusters(bd) if len(c)>=40]
    out={}
    for c in cl:
        assert len(c)==55, (p,len(c))
        rows=group_rows(c,1,2.0)
        assert [len(r) for r in rows]==[1,2,2,3,3,3,4,4,4,4,5,5,5,5,5], (p,[len(r) for r in rows])
        top=min(b[1] for b in c); left=min(b[0] for b in c)
        cand=[l for l in labs if l[2]<=top+2 and l[1]<left+12]
        cand.sort(key=lambda l:(abs(l[2]-top), abs(l[1]-left)))
        n=cand[0][0]
        layers=[]; i=0
        for k in range(1,6):
            layers.append([''.join(cells(r,glyphs)) for r in rows[i:i+k]]); i+=k
        out[n]=layers
    return out

from extract import SIZES
res2={}; res3={}
for p in PAGES_2D:
    r=do2d(p); print('2D page',p,len(r),sorted(r)[:1],sorted(r)[-1:]); res2.update(r)
for p in PAGES_3D:
    r=do3d(p); print('3D page',p,len(r),sorted(r)[:1],sorted(r)[-1:]); res3.update(r)
print('2D total',len(res2),'3D total',len(res3))
print('2D range',min(res2),max(res2),'missing',[i for i in range(1,251) if i not in res2])
print('3D range',min(res3),max(res3),'missing',[i for i in range(251,501) if i not in res3])

# plantilla geomètrica del diagrama 3D (idèntica per a tots els reptes 3D)
_b,_g,_bd = page_items(28)
_cl = sorted([c for c in clusters(_b) if len(c)>=40], key=lambda c: min(x[0] for x in c))[0]
_rows = group_rows(_cl,1,2.0)
_x0 = min(b[0]-b[2] for b in _cl); _y0 = min(b[1]-b[2] for b in _cl)
_w  = max(b[0]+b[2] for b in _cl)-_x0; _h = max(b[1]+b[2] for b in _cl)-_y0
tpl = {'w':1.0,'h':round(_h/_w,5),
       'rows':[[[round((b[0]-_x0)/_w,5), round((b[1]-_y0)/_w,5), round(b[2]/_w,5)] for b in row] for row in _rows]}

HERE=os.path.dirname(os.path.abspath(__file__))
json.dump({'2d':res2,'3d':res3},open(os.path.join(HERE,'puzzles_raw.json'),'w'))
json.dump(tpl,open(os.path.join(HERE,'tpl3d.json'),'w'))
print('escrit puzzles_raw.json i tpl3d.json')
