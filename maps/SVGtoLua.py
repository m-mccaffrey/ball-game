from xml.dom import minidom
import numpy as np
import os


def getColor(s):
    substr = 'fill:#'
    pos = s.find(substr) + len(substr)
    col = s[pos:pos+6]
    if col == 'ffff00':
        return 'yel'
    elif col == 'ff00ff':
        return 'mag'
    elif col == '00ffff':
        return 'cyn'
    elif col == '00ff00':
        return 'grn'
    elif col == 'ffffff':
        return 'wht'
    elif col == '000000':
        return 'blk'
    else:
        return 'gry'


def bezierToPoints(p):
    numPoints = 10
    B = []
    i = 0
    for t in np.linspace(0, 1, numPoints):
        B.append(str(float(p[0]) * ((1 - t) ** 3) + 3 * t*float(p[2]) * ((1 - t) ** 2)
                     + 3 * t**2*float(p[4]) * ((1 - t) ** 2) + t**3*float(p[6]) * (t ** 3)))
        i += 1
        B.append(str(float(p[1]) * ((1 - t) ** 3) + 3 * t*float(p[3]) * ((1 - t) ** 2)
                     + 3 * t**2*float(p[5]) * ((1 - t) ** 2) + t**3*float(p[7]) * (t ** 3)))
        i += 1
    return B


def parse(path):
    path = path.replace(",", " ")
    path = path.replace("M", " ")
    path = path.replace("L", " ")
    path = path.replace("Z", " ")
    path_words = path.split()
    i = 0
    for word in path_words:
        if word == 'M':
            path_words.remove(word)
        elif word == 'V':
            path_words[i] = path_words[i-2]
        elif word == 'H':
            path_words[i] = path_words[i+1]
            path_words[i+1] = path_words[i-1]
        elif word == 'C':
            path_words[i+1:i+7] = bezierToPoints(path_words[i-2:i] + path_words[i+1:i+7])[2:]
            path_words.remove(word)
        i += 1
    return path_words


def getCenter(path):
    x = []
    y = []
    i = 0
    for point in path:
        if i % 2 == 0:
            x.append(point)
        else:
            y.append(point)
        i += 1

    xmin = min(x, key=float)
    xmax = max(x, key=float)
    ymin = min(y, key=float)
    ymax = max(y, key=float)

    xc = str((float(xmin) + float(xmax)) / 2)
    yc = str((float(ymin) + float(ymax)) / 2)

    return xc, yc


def putCommas(l):
    l2 = []
    for i in l:
        a = ','
        if l.index(i) % 2 == 1:
            a += ' '
        l2.append(i+a)
    return l2


def makeString(list):
    return "".join(list)


mapFile = open('mapsData.lua', 'a')
for file in os.listdir("./"):
    if file.endswith("7.svg"):
        doc = minidom.parse(file)

        print("newMap = {}")
        print("newMap['shapes']  = {}")
        print("newMap['targets'] = {}")
        print("newMap['balls']   = {}")

        circle_attr = [[path.getAttribute('id'), path.getAttribute('cx'), path.getAttribute('cy')] for path
                       in (doc.getElementsByTagName('circle') + doc.getElementsByTagName('ellipse'))]
        for attr in circle_attr:
            print("table.insert(newMap['" + attr[0] + "s'],{" + attr[1] + ',' + attr[2] + ',' + '})')

        path_strings = [[path.getAttribute('d'), path.getAttribute('style')] for path
                        in doc.getElementsByTagName('path')]
        for thisPath in path_strings:
            color = getColor(thisPath[1])
            pointList = parse(thisPath[0])
            pointString = makeString(putCommas(pointList))
            cx, cy = getCenter(pointList)
            s = "".join(["table.insert(newMap['shapes'],{",
                         color,
                         ", 'poly', ",
                         cx,
                         ", ",
                         cy,
                         ", ",
                         "{",
                         pointString,
                         "}})"])
            print(s)
        print("table.insert(maps, newMap)")
        print("\n")
        doc.unlink()


