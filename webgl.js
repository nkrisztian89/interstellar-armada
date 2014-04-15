/**
 * @fileOverview This file is the main source file for the Armada project.
 * @author <a href="mailto:nkrisztian89@gmail.com">Krisztián Nagy</a>
 * @version 0.1
 */

/** 
 * Function to load additional JavaScript code from a list of source files.
 * Loads the scripts in the specified order, then executes a callback function.
 * @param {String[]} urls The list of JavaScript sourse files to load
 * @param {function} callback The function to call after loading the scripts
 */
function loadScripts(urls,callback) {
    // Adding the script tag to the head as suggested before
    var head = document.getElementsByTagName('head')[0];
    var script = document.createElement('script');
    script.type = 'text/javascript';
    script.src = urls.shift()+"?123";

    // Then bind the event to the callback function.
    // There are several events for cross browser compatibility.
    if(urls.length>0) {
		script.onload = function() {loadScripts(urls,callback);};
		//script.onreadystatechange = loadScripts(urls,callback);
	} else {
		script.onload = callback;
		//script.onreadystatechange = callback;
	}

    // Fire the loading
    head.appendChild(script);
}

/** 
 * Entry point of the whole JavaScript program. Initiates loading the other
 * script files and the external resources.
 */
function start() {
	document.getElementById("status").innerHTML="loading program source...";
	loadScripts(["matrices.js","egom.js","graphics.js","physics.js","logic.js","grid.js","control.js"],loadResources);
}

var ang=0.7;
var lightTurn=true;

var num_test_goals=10;
var num_test_fighters=40;
var num_test_ships=15;
var mapSize=250;

function loadResources() {
	var canvas = document.getElementById("canvas");
	var progress = document.getElementById("progress");
	
	var resourceCenter = new ResourceCenter(canvas,new LODContext(4,[0,30,60,250,400]));
	
	var mainScene = new Scene(0,0,canvas.width,canvas.height,true,[true,true,true,true],[0,0,0,1],true,undefined);
	//var pipScene = new Scene(canvas.width*2/3,canvas.height/4,canvas.width/3,canvas.height/2,false,[true,true,true,true],[0,0.5,0,0.5],true);
	
	mainScene.uniformValueFunctions['u_lightDir'] = function() { return [-Math.cos(ang),Math.sin(ang),0.0]; };
	mainScene.uniformValueFunctions['u_cameraMatrix'] = function() { return mul(mainScene.activeCamera.position,mainScene.activeCamera.orientation); };
	mainScene.uniformValueFunctions['u_projMatrix'] = function() { return mainScene.activeCamera.perspective; };
	mainScene.uniformValueFunctions['u_eyePos'] = function() 
		{
			//var eyeOffset = vector3Matrix3Product([0,0,-mainScene.activeCamera.focusDistance],transposed3(inverse3(matrix3from4(mainScene.activeCamera.orientation))));
			var eyePos = [
				-mainScene.activeCamera.position[12],//+eyeOffset[0],
				-mainScene.activeCamera.position[13],//+eyeOffset[1],
				-mainScene.activeCamera.position[14]//+eyeOffset[2]
				];
			//document.getElementById("output").innerHTML+=" |EP: "+vector3ToString(eyePos)+" | ";
			return [eyePos[0],eyePos[1],eyePos[2]]; 
		};
	
	resourceCenter.scenes.push(mainScene);
	//resourceCenter.scenes.push(pipScene);
	
	var test_level = new Level(resourceCenter,mainScene);
	
	test_level.loadFromFile("level.xml");
	
	progress.value=50;
	document.getElementById("status").innerHTML="loading additional configuration...";
	
	//test_level.spacecrafts[0].physicalModel.orientation=
	//	rotationMatrix4([1,0,0],-3.1415/2);
	
	test_level.spacecrafts[test_level.spacecrafts.length-1].physicalModel.orientation=
		mul(
			rotationMatrix4([0,1,0],3.1415/4),
			rotationMatrix4([0,0,1],3.1415/2)
			);
	
	for(var i=0;i<num_test_fighters;i++) {
		test_level.spacecrafts.push(
			new Spacecraft(
				new GraphicsContext(resourceCenter,mainScene),
				new LogicContext(test_level),
				test_level.getSpacecraftClass("fecske"),
				test_level.getPlayer("human"),
				translationMatrix(Math.random()*mapSize-mapSize/2,Math.random()*mapSize-mapSize/2,Math.random()*mapSize-mapSize/2),
				"ai"
				)
			);
		test_level.spacecrafts[test_level.spacecrafts.length-1].addWeapon(resourceCenter,test_level.getWeaponClass("plasma"));
		test_level.spacecrafts[test_level.spacecrafts.length-1].addWeapon(resourceCenter,test_level.getWeaponClass("plasma"));
		test_level.spacecrafts[test_level.spacecrafts.length-1].addPropulsion(resourceCenter,test_level.getPropulsionClass("fighter"));
	}
	
	for(var i=0;i<num_test_ships;i++) {
		test_level.spacecrafts.push(
			new Spacecraft(
				new GraphicsContext(resourceCenter,mainScene),
				new LogicContext(test_level),
				test_level.getSpacecraftClass("fregatt"),
				test_level.getPlayer("human"),
				translationMatrix(Math.random()*mapSize-mapSize/2,Math.random()*mapSize-mapSize/2,Math.random()*mapSize-mapSize/2),
				"ai"
				)
			);
		test_level.spacecrafts[test_level.spacecrafts.length-1].addWeapon(resourceCenter,test_level.getWeaponClass("cannon"));
		test_level.spacecrafts[test_level.spacecrafts.length-1].addWeapon(resourceCenter,test_level.getWeaponClass("cannon"));
		test_level.spacecrafts[test_level.spacecrafts.length-1].addPropulsion(resourceCenter,test_level.getPropulsionClass("frigate"));
	}
		
	for(var i=0;i<test_level.spacecrafts.length;i++) {	
		resourceCenter.cameras.push(new Camera(canvas.width/canvas.height,60,false,true,test_level.spacecrafts[i].visualModel));
	}
	//resourceCenter.cameras[1].followPosition=translationMatrix(0,-5,2);
	resourceCenter.cameras[1].followPosition=translationMatrix(0,-6,1);
	resourceCenter.cameras[2].followPosition=translationMatrix(0,-4,6);
	resourceCenter.cameras[2].followOrientation=rotationMatrix4([1,0,0],-45);
	//resourceCenter.cameras[4].followPosition=translationMatrix(0,-5,2);
	resourceCenter.cameras[4].followPosition=translationMatrix(0,-10,2);
	resourceCenter.cameras[7].followPosition=translationMatrix(0,-6,3);
	//resourceCenter.cameras[8].followPosition=translationMatrix(0,0,4);
	resourceCenter.cameras[8].followPosition=translationMatrix(0,-3,4);
	//resourceCenter.cameras[8].followPosition=translationMatrix(0,5,-0.1);
	resourceCenter.cameras[9].followPosition=translationMatrix(0,-25,20);
	
	for(var i=0;i<test_level.spacecrafts.length;i++) {
		for(var j=0;j<num_test_goals;j++) {
			test_level.spacecrafts[i].controller.goals.push(new Goal(translationMatrix(Math.random()*mapSize-mapSize/2,Math.random()*mapSize-mapSize/2,Math.random()*mapSize-mapSize/2)));
		}
	}
	
	mainScene.activeCamera.position=
		mul(
			mainScene.activeCamera.position,
			translationMatrix(0,10,-10)
		);
		
	mainScene.activeCamera.orientation=
		mul(
			mainScene.activeCamera.orientation,
			rotationMatrix4([1,0,0],3.1415/4)
		);
	
	//test_level.spacecrafts[0].controller=new FighterController(test_level.spacecrafts[0],new GraphicsContext(resourceCenter,mainScene),new LogicContext(test_level));
	//for(var i=1;i<test_level.spacecrafts.length;i++) {
	//	test_level.spacecrafts[i].controller=new FighterController(test_level.spacecrafts[i],new GraphicsContext(resourceCenter,mainScene),new LogicContext(test_level));
	//}
	
	//pipScene.objects.push(new VisualObject(fregattModel,metalTexture,greenShader,0.0045,translationMatrix(0.0,0.0,-2.0),true));
	
	var freq = 30;
	
	progress.value=75;
	
	resourceCenter.init(canvas,freq);
	
	document.onkeydown = handleKeyDown;
    document.onkeyup = handleKeyUp;
    document.onkeypress = handleKeyPress;
	
	setInterval(function()
		{
			test_level.tick(1000/freq);
			control(resourceCenter,mainScene,test_level);
			ang+=lightTurn?0.07:0.0;
		},1000/freq);
}
