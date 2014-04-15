function buildGrid(width,height,tileSize) {
	var grid = new EgomModel();
	
	for(var i=0;i<=width;i++) {
		grid.vertices.push([(-width/2+i)*tileSize,(height/2)*tileSize,0]);
		grid.vertices.push([(-width/2+i)*tileSize,-(height/2)*tileSize,0]);
		grid.lines.push(new Line(grid.vertices.length-2,grid.vertices.length-1,0,1,0,1,0,0,1));
	}
	for(var i=0;i<=height;i++) {
		grid.vertices.push([-(width/2)*tileSize,(-height/2+i)*tileSize,0]);
		grid.vertices.push([(width/2)*tileSize,(-height/2+i)*tileSize,0]);
		grid.lines.push(new Line(grid.vertices.length-2,grid.vertices.length-1,0,1,0,1,0,0,1));
	}
	
	return grid;
}
