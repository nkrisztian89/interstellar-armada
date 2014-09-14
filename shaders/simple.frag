// shader used in general for meshes

precision mediump float;
	
uniform sampler2D u_colorTexture;
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
	// interpolated normals can have different then unit length
        vec3 normal = normalize(v_normal);
    
	vec3 viewDir = normalize(v_worldPos.xyz - u_eyePos);
	vec3 reflDir = reflect (viewDir, normal);
	
	vec4 texCol = texture2D(u_colorTexture, v_texCoord);
	
	vec3 light1color = vec3(1.0,1.0,1.0);
        vec3 light2color = vec3(0.02,0.2,0.2);
	
	float specularFactor = v_shininess>0.0?pow(max(dot(reflDir,u_lightDir),0.0), v_shininess):0.0;
	
	gl_FragColor = 
		vec4(
                    // the RGB components
                        clamp(
                        // diffuse light reflected for different light sources
			light1color*max(0.0,dot(+u_lightDir,normal))+
			light2color*max(0.0,dot(-u_lightDir,normal))+
                        // add luminosity
                        v_luminosity*vec3(1.0,1.0,1.0)
                        // clamp each component
                        ,0.0,1.0)
                        // modulate with the colors from the vertices and the texture
                        // the above components cannot make the surface lighter then
                        // the modulated diffuse texture
			* v_color.rgb * texCol.rgb
                        // add specular lighting, this can make the surface "overlighted"
			+ specularFactor * vec3(1.0,1.0,1.0)
			,
                    // the alpha component from the attribute color and texture
                        v_color.a*texCol.a
		);
}
