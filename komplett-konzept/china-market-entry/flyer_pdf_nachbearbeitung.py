import pymupdf, sys
from PIL import Image
S=sys.argv[1]
LIB='/usr/share/fonts/truetype/liberation/LiberationSans-Bold.ttf'
F=pymupdf.Font(fontfile=LIB)
RN=dict(images=pymupdf.PDF_REDACT_IMAGE_NONE, graphics=pymupdf.PDF_REDACT_LINE_ART_NONE)
NAVY=(11/255,31/255,75/255); RED=(214/255,40/255,40/255)
PHONE='+49 177 2711123'

im=Image.open(S+'/kk_banner_neu.jpg'); im.crop((0,55,im.width,703)).save(S+'/banner_strip.jpg',quality=95)

def spans(p):
    for b in p.get_text('rawdict')['blocks']:
        for l in b.get('lines',[]):
            for s in l['spans']:
                s['text']=''.join(c['c'] for c in s['chars']); yield s
def rgb(c): return ((c>>16&255)/255,(c>>8&255)/255,(c&255)/255)
def put(p,x,y,t,size,col,align='left'):
    w=F.text_length(t,fontsize=size)
    if align=='right': x-=w
    if align=='center': x-=w/2
    p.insert_text((x,y),t,fontsize=size,fontname='LibB',fontfile=LIB,color=col)
    return x+w
def redact(p,r):
    p.add_redact_annot(pymupdf.Rect(r)); p.apply_redactions(**RN)

for fn,cn in [('KomplettKonzept_Canton_Fair_Flyer.pdf',True),('KomplettKonzept_Flyer_DEUTSCH_Lesefassung.pdf',False)]:
    src=pymupdf.open(S+'/src/'+fn); orig=pymupdf.open(S+'/src/'+fn)
    for pi,p in enumerate(src):
        ss=list(spans(p))
        # footer e-mail
        for s in ss:
            if 'info@komplett-konzept.de' in s['text']:
                redact(p,s['bbox'])
                put(p,p.rect.width/2,s['origin'][1],s['text'].replace('info@komplett-konzept.de','info@mapatec.de'),s['size'],rgb(s['color']),'center')
        # header contact line: WeChat number instead of "scannen"
        if cn:
            a=[s for s in ss if s['text']=='联' and s['bbox'][1]<80][0]; wx=[s for s in ss if s['text']=='信' and s['bbox'][1]<80][0]
            keep=pymupdf.Rect(a['bbox'][0]-0.5,60,wx['bbox'][2]-0.4,80)
            tail=' WeChat '+PHONE
            start=738.6-keep.width-F.text_length(tail,fontsize=13.5)
            redact(p,(370,60,745,80))
            p.show_pdf_page(pymupdf.Rect(start,60,start+keep.width,80),orig,pi,clip=keep)
            put(p,start+keep.width,75.1,tail,13.5,NAVY)
        else:
            redact(p,(395,60,745,80))
            put(p,738.6,75.1,'Ansprechpartner: Mario Parlitz · WeChat '+PHONE,13.5,NAVY,'right')
        # logo smaller + www.komplett-konzept.de underneath
        lg=[i for i in p.get_image_info(xrefs=True) if i['bbox'][0]<40 and i['bbox'][1]<20 and i['bbox'][2]<300][0]
        smask=[g[1] for g in p.get_images(full=True) if g[0]==lg['xref']][0]
        pix=pymupdf.Pixmap(src,lg['xref'])
        if smask: pix=pymupdf.Pixmap(pix,pymupdf.Pixmap(src,smask))
        img={'width':pix.width,'height':pix.height}
        p.draw_rect(pymupdf.Rect(26,6,214,101),color=None,fill=(1,1,1))
        h=70; w=h*img['width']/img['height']; cx=119
        p.insert_image(pymupdf.Rect(cx-w/2,6,cx+w/2,6+h),pixmap=pix)
        put(p,cx,93,'www.komplett-konzept.de',11,NAVY,'center')
        if pi==1:
            t=[s for s in ss if '×' in s['text']][0]
            redact(p,t['bbox']); put(p,t['origin'][0],t['origin'][1],t['text'].replace('×','&'),t['size'],rgb(t['color']))
            # MapaTec box contact: Mario Parlitz + number
            if cn:
                redact(p,(409.5,1092,560,1108))  # removes 扫码 + "Scan WeChat →", keeps 联系人 … 微信
                put(p,410.0,1103.6,' WeChat '+PHONE,11.25,RED)
            else:
                redact(p,(220,1092,560,1108))
                put(p,225.0,1103.6,'Ansprechpartner: Mario Parlitz · WeChat '+PHONE,11.25,RED)
    # page 1 rebuild: banner = marked strip only, content moved up
    W,H=src[0].rect.width,src[0].rect.height
    bgx=[i['xref'] for i in src[0].get_image_info(xrefs=True) if i['bbox'][3]-i['bbox'][1]>1100][0]
    out=pymupdf.open(); p=out.new_page(width=W,height=H)
    p.insert_image(p.rect,stream=src.extract_image(bgx)['image'],keep_proportion=False)
    p.show_pdf_page(pymupdf.Rect(0,0,W,105),src,0,clip=pymupdf.Rect(0,0,W,105))
    p.insert_image(pymupdf.Rect(0,105,W,431),filename=S+'/banner_strip.jpg',keep_proportion=False)
    y=446
    for (a,b),g in zip([(580,718),(718,856),(856,948),(948,1125),(1125,1188)],[26,26,30,30,0]):
        p.show_pdf_page(pymupdf.Rect(0,y,W,y+b-a),src,0,clip=pymupdf.Rect(0,a,W,b)); y+=b-a+g
    # badge on the banner: 30+ years of online retail experience
    NOTO=S+'/NotoSC_badge.ttf'; NF=pymupdf.Font(fontfile=NOTO)
    l1,l2,s1,s2=(('30多年电商经验','30+ years of e-commerce experience',22,11.5) if cn else ('Über 30 Jahre','Erfahrung im Onlinehandel',24,13))
    bw=max(NF.text_length(l1,fontsize=s1),NF.text_length(l2,fontsize=s2))+28
    r=pymupdf.Rect(22,120,22+bw,120+s1+s2+26)
    p.draw_rect(r+(2,2,2,2),color=None,fill=(0,0,0),fill_opacity=0.35,radius=0.18)
    p.draw_rect(r,color=(1,1,1),width=1.5,fill=RED,radius=0.18)
    for t,sz,yy in [(l1,s1,r.y0+9+s1),(l2,s2,r.y0+15+s1+s2)]:
        tw=pymupdf.TextWriter(p.rect); tw.append((r.x0+(r.width-NF.text_length(t,fontsize=sz))/2,yy-2),t,font=NF,fontsize=sz); tw.write_text(p,color=(1,1,1))
    pm=p.get_pixmap(dpi=144)
    for a,b in [(916,1042),(1072.5,1094.5)]:   # stray divider line from the Canva layout
        c=pm.pixel(1222,int(a+b)); p.draw_rect(pymupdf.Rect(614.5,a,617.5,b),color=None,fill=tuple(x/255 for x in c))
    # flatten page 1 (nested clipped forms render badly in Edge) -> 300 dpi image page
    pix=out[0].get_pixmap(dpi=300)
    flat=pymupdf.open(); fp=flat.new_page(width=W,height=H)
    fp.insert_image(fp.rect,stream=pix.tobytes('jpg',jpg_quality=92))
    flat.insert_pdf(src,from_page=1,to_page=1)
    flat.save(fn,garbage=4,deflate=True); print('ok',fn)
