precision mediump float;
	
// our texture
uniform sampler2D u_image;
uniform vec3 u_lightDir;
uniform vec3 u_eyePos;

	
// the texCoords passed in from the vertex shader.
varying vec2 v_texCoord;
varying vec3 v_normal;
varying vec4 v_color;
varying float v_luminosity;
varying float v_shininess;

varying vec4 v_worldPos;

	
void main() {
	//vec3 viewDir = normalize(u_eyePos - v_worldPos.xyz);
	//vec3 reflDir = reflect (viewDir, v_normal);
	
	vec4 texCol = texture2D(u_image, v_texCoord);
	
	//float specularFactor = v_shininess>0.0?pow(max(dot(-reflDir,u_lightDir),0.0), v_shininess):0.0;
	
	gl_FragColor = 
		vec4(
			((min(1.0,
				(
					v_luminosity + 
					max(dot(u_lightDir,v_normal),0.0)
				)
			)
			*v_color.rgb) +
			(
				vec3(0.02,0.2,0.2)*min(1.0,max(dot(-u_lightDir,v_normal),0.0)) 
			*v_color.rgb))
			*texCol.rgb
			//+ specularFactor * vec3(1.0,1.0,1.0)
			,
		v_color.a*texCol.a
		);
		//vec4(v_normal,1.0);
}
