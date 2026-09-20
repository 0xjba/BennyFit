import re, html, sys
t = open(sys.argv[1], encoding='utf-8', errors='replace').read()
t = re.sub(r'(?is)<(script|style|svg|noscript)[^>]*>.*?</\1>', ' ', t)
t = re.sub(r'(?is)<br\s*/?>', '\n', t)
t = re.sub(r'(?is)<t[dh][^>]*>', '\t', t)
t = re.sub(r'(?is)</(p|div|tr|li|h[1-6]|td|th|table)>', '\n', t)
t = re.sub(r'(?is)<[^>]+>', ' ', t)
t = html.unescape(t)
lines = [re.sub(r'[\s ]+', ' ', l).strip() for l in t.split('\n')]
print('\n'.join(l for l in lines if l))
