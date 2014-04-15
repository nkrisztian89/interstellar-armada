precision mediump float;

uniform mat4 u_viewDirectionProjectionInverse;
uniform samplerCube u_skybox;
uniform vec3 u_lightDir;

varying vec3 v_position;

void main() {
	vec4 t = u_viewDirectionProjectionInverse * vec4(v_position,1.0);
	gl_FragColor = 
		textureCube(u_skybox,normalize(t.xyz/t.w));
		//+vec4(0.3,0.0,0.0,1.0);
		//+vec4(max(min(dot(normalize(t.xyz/t.w),normalize(u_lightDir))-0.5,1.0),0.0)*vec3(1.0,1.0,1.0),1.0);
}
