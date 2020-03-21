v_texCoord = a_texCoord;
v_color = ifEqualAElseB(a_color, u_originalFactionColor, u_replacementFactionColor, a_color);