import json, sys

locales = ['en','zh','zh-TW','ko','ja','pt','es','de','fr','vi']
for loc in locales:
    raw = open('messages/'+loc+'.json', encoding='utf-8').read()
    class D:
        def __init__(self): self.d=[]
        def __call__(self, p):
            s={}
            for k,v in p:
                if k in s: self.d.append(k)
                s[k]=v
            return s
    dc=D()
    json.loads(raw, object_pairs_hook=dc)
    result = (loc+': DUPS='+str(dc.d)) if dc.d else (loc+': OK')
    print(result)
