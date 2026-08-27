import json,os
HERE=os.path.dirname(os.path.abspath(__file__))
raw=json.load(open(os.path.join(HERE,'puzzles_raw.json')))
shapes=json.load(open(os.path.join(HERE,'shapes.json')))
tpl=json.load(open(os.path.join(HERE,'tpl3d.json')))
COLORS={'A':'#F79806','B':'#EF3338','C':'#00ADEF','D':'#F694CF','E':'#98D320',
        'F':'#FFFFFF','G':'#7ED5E5','H':'#F03BA6','I':'#F0E406','J':'#5E54AE',
        'K':'#DAEE94','L':'#C8C0B6'}
SIZES={'A':4,'B':5,'C':5,'D':5,'E':5,'F':3,'G':5,'H':5,'I':5,'J':4,'K':4,'L':5}
out={
 'colors':COLORS,'sizes':SIZES,'shapes':shapes,'tpl3d':tpl,
 'notes':{'302':'El quadern original mostra només 1 boleta rosa (D); sembla una errata de la guia.'},
 'p2d':{str(k):raw['2d'][str(k)] for k in range(1,251)},
 'p3d':{str(k):raw['3d'][str(k)] for k in range(251,501)},
}
json.dump(out, open(os.path.join(HERE,'..','data','puzzles.json'),'w'), separators=(',',':'))
print(os.path.getsize(os.path.join(HERE,'..','data','puzzles.json')), 'bytes')
