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
	vec4 texCol = texture2D(u_image, v_texCoord);
	
	vec4 color = 
		vec4(
			((min(1.0,
				(
					0.65 + // ambient
					0.35*
					(
						v_luminosity + 
						max(dot(u_lightDir,v_normal),0.0)
					)
				)
			)
			*v_color.rgb))
			*texCol.rgb
			,
		v_color.a*texCol.a
		);
	if (v_worldPos.z<-60.0) {
		color.rgba = vec4(1.0,1.0,1.0,1.0);
	} else if (v_worldPos.z<-30.0) {
		color.rgba = 
			(color.rgba * max(0.0,(60.0+v_worldPos.z) / 30.0)) + 
			(vec4(1.0,1.0,1.0,1.0) * min(1.0,-((v_worldPos.z+30.0)/30.0)));
	}
	gl_FragColor = color;
}
