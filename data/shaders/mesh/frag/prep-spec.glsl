vec4 texSpec = texture2D(u_specularTexture, v_texCoord);
vec3 viewDir = normalize(v_viewDir);
vec3 reflDir = reflect (viewDir, normal);