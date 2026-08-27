import re, os, subprocess, json, sys
from collections import defaultdict
HERE=os.path.dirname(os.path.abspath(__file__))
PDF=os.path.join(HERE,'..','KanoodleUltimateChampionGuide.pdf')
NUM=re.compile(r'-?\d+(?:\.\d+)?')
PATH=re.compile(r'<path([^>]*)/>')
ATTR=re.compile(r'(\S+)="([^"]*)"')
DARK='rgb(13.729858%, 12.159729%, 12.548828%)'
BOARD='rgb(6.518555%, 4.460144%, 3.430176%)'
WHITE='rgb(100%, 100%, 100%)'

def get_svg(p):
    d=os.path.join(HERE,'svg'); os.makedirs(d,exist_ok=True)
    f=os.path.join(d,f'p{p}.svg')
    if not os.path.exists(f):
        subprocess.run(['pdftocairo','-svg','-f',str(p),'-l',str(p),PDF,f],check=True)
    return open(f).read()

def rgb(fill):
    return tuple(float(x)*2.55 for x in NUM.findall(fill))

def bbox(d):
    n=[float(x) for x in NUM.findall(d)]
    xs=n[0::2]; ys=n[1::2]
    return min(xs),min(ys),max(xs),max(ys)

def page_items(p):
    s=get_svg(p); s=s[s.index('</defs>'):]
    balls=[]; glyphs=[]; boards=[]
    for m in PATH.finditer(s):
        at=dict(ATTR.findall(m.group(1)))
        fill=at.get('fill')
        if not fill or fill=='none': continue
        d=at['d']
        if sum(rgb(fill))<150:
            x0,y0,x1,y1=bbox(d)
            if 95<x1-x0<112 and 43<y1-y0<54: boards.append((x0,y0,x1,y1)); continue
        for sp in ('M'+q for q in d.split('M')[1:]):
            nc=sp.count('C')
            if nc==0: continue
            x0,y0,x1,y1=bbox(sp)
            w=x1-x0; h=y1-y0
            if nc==4 and abs(w-h)<0.25 and 7.0<w<11.0:
                balls.append([(x0+x1)/2,(y0+y1)/2,(w+h)/4,fill])
            elif fill==DARK and 2.0<h<7.5 and w<7.5:
                glyphs.append(((x0+x1)/2,(y0+y1)/2))
    # painter's algorithm: later paths cover earlier ones at the same spot
    seen={}
    for b in balls:
        key=None
        for k in seen:
            if abs(k[0]-b[0])<2.0 and abs(k[1]-b[1])<2.0: key=k; break
        if key is not None: del seen[key]
        seen[(b[0],b[1])]=b
    return list(seen.values()), glyphs, boards

def labels(p):
    txt=subprocess.run(['pdftotext','-f',str(p),'-l',str(p),'-bbox',PDF,'-'],capture_output=True,text=True).stdout
    res=[]
    for m in re.finditer(r'<word xMin="([\d.]+)" yMin="([\d.]+)" xMax="([\d.]+)" yMax="([\d.]+)">\D?(\d{3})</word>',txt):
        res.append((int(m.group(5)), float(m.group(1)), float(m.group(2))))
    return sorted(res)

COLORS={
 'A':[(247,152,15),(247,143,38)],
 'B':[(239,51,56),(239,50,56)],
 'C':[(0,173,239),(67,178,233)],
 'D':[(246,165,214),(239,148,207)],
 'E':[(152,211,32),(139,208,55)],
 'G':[(126,213,229),(140,217,235),(153,222,249)],
 'H':[(240,59,166),(236,0,140)],
 'I':[(240,228,6),(245,232,18),(255,242,0)],
 'J':[(94,84,174)],
 'K':[(218,238,148),(185,226,114)],
 'L':[(200,192,182),(244,243,219)],
}
SIZES={'A':4,'B':5,'C':5,'D':5,'E':5,'F':3,'G':5,'H':5,'I':5,'J':4,'K':4,'L':5}
def letter(fill):
    if fill==WHITE: return None
    c=rgb(fill)
    best=None;bd=9
    for L,cands in COLORS.items():
        for cc in cands:
            d=sum((a-b)**2 for a,b in zip(c,cc))
            if d<bd: bd=d;best=L
    assert bd<1500, (fill,bd,best)
    return best

def group_rows(items, key=1, tol=1.5):
    items=sorted(items,key=lambda b:b[key])
    rows=[];cur=[items[0]]
    for b in items[1:]:
        if b[key]-cur[-1][key]<=tol: cur.append(b)
        else: rows.append(cur); cur=[b]
    rows.append(cur)
    for r in rows: r.sort(key=lambda b:b[0])
    return rows

def cells(balls, glyphs):
    """return list of letters ('.' for empty) with F detection"""
    res=[]
    for b in balls:
        L=letter(b[3])
        if L is None:
            has=any((g[0]-b[0])**2+(g[1]-b[1])**2 < (b[2]*0.8)**2 for g in glyphs)
            L='F' if has else '.'
        res.append(L)
    return res

def clusters(balls, tol=12.0):
    """single linkage clustering on proximity"""
    pts=sorted(range(len(balls)), key=lambda i:(balls[i][0],balls[i][1]))
    parent=list(range(len(balls)))
    def find(a):
        while parent[a]!=a: parent[a]=parent[parent[a]]; a=parent[a]
        return a
    def uni(a,b):
        ra,rb=find(a),find(b)
        if ra!=rb: parent[ra]=rb
    for i in range(len(balls)):
        for j in range(i+1,len(balls)):
            if abs(balls[i][0]-balls[j][0])<tol and abs(balls[i][1]-balls[j][1])<tol:
                uni(i,j)
    g=defaultdict(list)
    for i,b in enumerate(balls): g[find(i)].append(b)
    return list(g.values())
