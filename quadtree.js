const canvas = document.getElementById("canvas");
const g = canvas.getContext('2d');

const SIZE = canvas.width;

class Point{
	posx;
	posy;
	color;
	size;

	constructor(x, y, color = "#ff0000"){
		this.posx = x;
		this.posy = y;
		this.color = color;
		this.size = 2;
	}
}

class QuadTree{
	static MaxEntries = 2;
	static MaxDepth = 8;
	static Operations = 0;
	static PPComp = 0;
	static AnimStates = null;
	static Optimized = true;

	entries;
	children;
	minx;
	miny;
	size;
	depth;

	constructor(minx, miny, size, depth=0){
		this.minx = minx;
		this.miny = miny;
		this.size = size;
		this.depth = depth;

		this.children = null;
		this.entries = new Array();
	}

	insert(point){
		if(this.depth == 0)
			QuadTree.Operations = 0;

		++QuadTree.Operations;
		if(this.entries != null){
			this.entries.push(point);

			if(this.entries.length > QuadTree.MaxEntries)
				this.#subdivide();

			return;
		}

		var x = point.posx - this.minx;
		var y = point.posy - this.miny;
		var halfsize = this.size / 2;

		var index = 0;
		index = index | ((x >= halfsize) ? 1:0) << 1;
		index = index | ((y >= halfsize) ? 1:0);

		this.children[index].insert(point);
	}

	addFromList(list){
		if(list.length < 1)
			return;

		var listlen = list.length;
		for(var i = 0; i < listlen; ++i){
			var p = list[i];
			var x = p.posx - this.minx;
			var y = p.posy - this.miny;

			if(x >= 0 && y >= 0 && x < this.size && y < this.size){
				this.entries.push(p);

				var p2 = list[listlen - 1];
				list[i] = p2;
				list.pop();
				--listlen;
				--i;
			}
		}

		if(this.entries.length > QuadTree.MaxEntries)
			this.#subdivide();
	}

	#subdivide(){
		++QuadTree.Operations;

		if(this.children != null || this.depth >= QuadTree.MaxDepth)
			return;

		var newdepth = this.depth + 1;
		var newsize = this.size / 2;

		this.children = new Array();
		this.children[0b00] = new QuadTree(this.minx, this.miny, newsize, newdepth);
		this.children[0b00].addFromList(this.entries);

		this.children[0b10] = new QuadTree(this.minx + newsize, this.miny, newsize, newdepth);
		this.children[0b10].addFromList(this.entries);

		this.children[0b01] = new QuadTree(this.minx, this.miny + newsize, newsize, newdepth);
		this.children[0b01].addFromList(this.entries);

		this.children[0b11] = new QuadTree(this.minx + newsize, this.miny + newsize, newsize, newdepth);
		this.children[0b11].addFromList(this.entries);

		this.entries = null;
	}

	getDistance(px, py){
		var dx = Math.max(this.minx - px, 0, px - this.minx - this.size);
		var dy = Math.max(this.miny - py, 0, py - this.miny - this.size);

		return dx * dx + dy * dy;
	}

	#findClosestPoint(px, py){
		var closest = {
			dist: Number.MAX_VALUE,
			point: null
		};

		if(this.entries == null)
			return closest;

		for(var i = 0; i < this.entries.length; ++i){
			var p = this.entries[i];
			var dx = p.posx - px;
			var dy = p.posy - py;
			var dist = dx * dx + dy * dy;
			++QuadTree.Operations;
			++QuadTree.PPComp;

			if(dist < closest.dist){
				closest.dist = dist;
				closest.point = p;
			}
		}

		QuadTree.AnimStates.push({
			ops: QuadTree.Operations,
			region: this,
			visited: true,
			ppcomp: QuadTree.PPComp
		})

		return closest;
	}

	findClosestInRadius(px, py, radius = Number.MAX_VALUE){
		if(this.depth == 0){
			QuadTree.Operations = 0;
			QuadTree.PPComp = 0;

			QuadTree.AnimStates = new Array();
		}
		++QuadTree.Operations;

		QuadTree.AnimStates.push({
			ops: QuadTree.Operations,
			region: this,
			ppcomp: QuadTree.PPComp
		})

		if(this.children == null)
			return this.#findClosestPoint(px, py);

		var closest = {
			dist: radius,
			point: null
		}

		var halfsize = this.size / 2;
		var x = px - this.minx;
		var y = py - this.miny;
		var index = 0;
		index = index | (x >= halfsize ? 1 : 0) << 1;
		index = index | (y >= halfsize ? 1 : 0);

		index = index & (QuadTree.Optimized ? 3 : 0);

		for(var i = index; ;){
			++QuadTree.Operations;
			var child = this.children[i];
			if(child.getDistance(px, py) <= closest.dist){
				var newclosest = child.findClosestInRadius(px, py, closest.dist);
				if(newclosest.point != null && newclosest.dist <= closest.dist)
					closest = newclosest;
			}

			i = (++i) & 3; // = (++i) % 4;
			if(i == index)
				break;
		}

		return closest;
	}

	isEmpty(){
		return this.children == null && (this.entries == null || this.entries.length < 1);
	}

	remove(point){
		if(point == null)
			return false;

		if(this.depth == 0){
			QuadTree.Operations = 0;
			QuadTree.PPComp = 0;
		}
		++QuadTree.Operations;

		if(this.children == null){
			for(var i = 0; i < this.entries.length; ++i){
				++QuadTree.Operations;
				if(this.entries[i] == point){
					var p2 = this.entries[this.entries.length - 1];
					this.entries[i] = p2;
					this.entries.pop();

					return true;
				}
			}

			return false;
		}

		var halfsize = this.size / 2;
		var x = point.posx - this.minx;
		var y = point.posy - this.miny;
		var index = 0;
		index = index | (x >= halfsize ? 1 : 0) << 1;
		index = index | (y >= halfsize ? 1 : 0);

		if(this.children[index].remove(point)){
			if(this.children[index].isEmpty()){
				var dead = true;

				for(var i = index; ; ){
					++QuadTree.Operations;
					dead = dead && this.children[i].isEmpty();

					var i = (++i) & 3;
					if(i == index || !dead)
						break;
				}

				if(dead){
					this.children = null;
					this.entries = new Array();

					return true;
				}
			}
		}

		return false;
	}
}

function drawPoints(pointTable){
	for(var i = 0; i < pointTable.length; i++){
		var x = pointTable[i].posx;
		var y = pointTable[i].posy;

		g.fillStyle = pointTable[i].color;
		var w = pointTable[i].size;
		g.fillRect(x,y,w,w)
	}
}

function drawQuadTree(tree){
	if(tree.children == null)
		return;

	g.moveTo(tree.minx, tree.miny + tree.size / 2);
	g.lineTo(tree.minx + tree.size, tree.miny + tree.size / 2);

	g.moveTo(tree.minx + tree.size / 2, tree.miny);
	g.lineTo(tree.minx + tree.size / 2, tree.miny + tree.size);

	for(var i = 0; i < tree.children.length; ++i){
		drawQuadTree(tree.children[i]);
	}
}

var TheTree = new QuadTree(0,0,SIZE);
var Points = [];
var SearchPoint = new Point(Math.random() * SIZE, Math.random() * SIZE, "#00ff00");
var IsAnimating = false;
var animHandle = null;
var animFrame = 0;
var animVisited = new Array();

function htmlupdateOperations(operations = QuadTree.Operations, comp = QuadTree.PPComp){
	const opcnt = document.getElementById("numoperations");
	const cmpcnt = document.getElementById("numcomparisons");
	opcnt.innerHTML = operations;
	cmpcnt.innerHTML = comp;
}

function htmlrefreshGraphics(){
	g.reset();
	g.setTransform(1, 0, 0, -1, 0, SIZE);

	g.strokeStyle = "#a0a0a0";
	g.beginPath();
	drawQuadTree(TheTree);
	g.stroke();

	drawPoints(Points);

	if(SearchPoint != null){
		g.fillStyle = SearchPoint.color;
		g.fillRect(SearchPoint.posx, SearchPoint.posy, 4, 4);
	}
}

function htmlresetPointParams(){
	for(var i = 0; i < Points.length; ++i){
		Points[i].color = "#ff0000";
		Points[i].size = 2;
	}
}

function htmlgenerateRandomPoints(){
	if(IsAnimating)
		return; 
	var amount = parseInt(document.getElementById("numRandPoints").value);
	var ops = 0;
	for(var i = Points.length; i < amount; i++){
		Points[i] = new Point(Math.random() * SIZE, Math.random() * SIZE);
		TheTree.insert(Points[i]);
		ops += QuadTree.Operations;
	}

	htmlupdateOperations(ops);
}

function htmlregenerateTree(){
	if(IsAnimating)
		return; 
	QuadTree.MaxEntries = parseInt(document.getElementById("numMaxentries").value)
	TheTree = new QuadTree(0,0,SIZE);

	var ops = 0;
	for(var i = 0; i < Points.length; ++i){
		TheTree.insert(Points[i]);
		ops += QuadTree.Operations;
	}

	htmlupdateOperations(ops);
}

function htmlclearTree(){
	if(IsAnimating)
		return; 
	TheTree = new QuadTree(0,0,SIZE);
	Points = [];

	htmlupdateOperations(0);
}

function htmlfindClosest(){
	QuadTree.Optimized = document.getElementById("nnsoptimized").checked;
	if(IsAnimating)
		return; 
	htmlresetPointParams();
	if(SearchPoint == null)
		return;

	var p = TheTree.findClosestInRadius(SearchPoint.posx, SearchPoint.posy);

	if(p.point != null){
		p.point.color = "#ffff00";
		p.point.size = 6;
	}

	htmlupdateOperations();
}
function htmlnnsStop(){
	clearInterval(animHandle);
	IsAnimating = false;
	htmlrefreshGraphics();
}

function animFrameCallback(){
	if(QuadTree.AnimStates == null || animFrame >= QuadTree.AnimStates.length){
		clearInterval(animHandle);
		IsAnimating = false;
		return;
	}

	var frame = QuadTree.AnimStates[animFrame];
	++animFrame;
	htmlupdateOperations(frame.ops, frame.ppcomp);

	if(frame.visited){
		animVisited.push(frame.region);
	}

	if(frame.ignored){
		animIgnored.push(frame.region);
	}

	htmlrefreshGraphics();

	g.fillStyle = "#0055ff";
	g.globalAlpha = 0.4;
	for(var i = 0; i < animVisited.length; ++i){
		var visited = animVisited[i];
		g.fillRect(visited.minx, visited.miny, visited.size, visited.size);
	}
	g.globalAlpha = 1;

	g.strokeStyle = "#ffa000";
	g.strokeWidth = 4;
	g.beginPath();
	g.rect(frame.region.minx, frame.region.miny, frame.region.size, frame.region.size);
	g.stroke();
}

function htmlnnsAnimate(){
	htmlfindClosest();
	IsAnimating = (QuadTree.AnimStates != null);
	animFrame = 0;
	animVisited = new Array();
	animHandle = setInterval(animFrameCallback, parseInt(document.getElementById("playbackSpeed").value));
	animFrameCallback();
}

canvas.addEventListener("click", (e) => {
	if(IsAnimating)
		return; 
	var canrect = canvas.getBoundingClientRect();
	var x = e.clientX - canrect.left;
	var y = e.clientY - canrect.top;

	if(e.button == 0 && x >= 0 && x <= canrect.width && y >= 0 && y < canrect.height){
		var realx = (x / canrect.width) * SIZE;
		var realy = SIZE - (y / canrect.height) * SIZE;
		if(document.getElementById("clickAdd").checked){
			var p = new Point(realx, realy);
			Points.push(p);
			TheTree.insert(p);

			htmlupdateOperations();
		}

		if(document.getElementById("clickSearch").checked){
			SearchPoint = new Point(realx, realy, "#00ff00");
		}

		if(document.getElementById("clickRemove").checked){
			var p = TheTree.findClosestInRadius(realx, realy, 200);
			if(p.point != null){
				TheTree.remove(p.point)
				var index = Points.indexOf(p.point);
				Points.splice(index, 1);
			}

			htmlupdateOperations();
		}
	}

	htmlrefreshGraphics();
})

htmlgenerateRandomPoints();
htmlrefreshGraphics();