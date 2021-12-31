"use strict";

const OPTIMIZE_COMPUTE_NORMALS = true;
const OPTIMIZE_NORMALIZE_NORMALS = true;

const padding = 2;

class ZMapGeometry extends THREE.BufferGeometry {

  static placeholderGeometry(width, height, widthPoints, heightPoints, zMap) {
    const geometry = new THREE.PlaneGeometry(width, height, 1, 1);
    geometry.boundingBox = ZMapGeometry.computeBoundingBox(width, height, widthPoints, heightPoints, zMap);
    geometry.parameters.widthPoints = widthPoints;
    geometry.parameters.heightPoints = heightPoints;
    geometry.parameters.zMap = zMap;
    return geometry;
  }

  static generateGeometry(width, height, widthPoints, heightPoints, zMap, boundingBox = null) {
    const geometry = new ZMapGeometry(width, height, widthPoints - 1, heightPoints - 1, zMap);
    geometry.boundingBox = boundingBox ?? ZMapGeometry.computeBoundingBox(width, height, widthPoints, heightPoints, zMap);

    if (!OPTIMIZE_COMPUTE_NORMALS) {
      geometry.computeVertexNormals();
    }

    return geometry;
  }

  static isPlaceholderGeometry(geometry) {
    return geometry.type !== "ZMapGeometry";
  }

  static replacePlaceholderGeometry(mesh) {
    const parameters = mesh.geometry.parameters;
    mesh.geometry = ZMapGeometry.generateGeometry(parameters.width, parameters.height, parameters.widthPoints, parameters.heightPoints, parameters.zMap, mesh.geometry.boundingBox);
  }

  static computeBoundingBox(width, height, widthPoints, heightPoints, zMap) {
    let zMax = -Infinity;
    let zMin = +Infinity;
    for (let y = 0; y < heightPoints; y++) {
      for (let x = 0; x < widthPoints; x++) {
        const z = zMap[y][x];
        if (z > zMax) { zMax = z; }
        if (z < zMin) { zMin = z; }
      }
    }
    return new THREE.Box3(
      new THREE.Vector3(-width / 2, -height / 2, zMin),
      new THREE.Vector3(+width / 2, +height / 2, zMax)
    );
  }

  constructor(width = 1, height = 1, widthSegments = 1, heightSegments = 1, zMap = []) {
    super();
    this.type = 'ZMapGeometry';
    this.parameters = {
      width: width,
      height: height,
      widthSegments: widthSegments,
      heightSegments: heightSegments,
    };

    this._createIndices(widthSegments, heightSegments, zMap);
  }

  static _indicesBuffer = new Uint16Array(251 * 251 * 6);

  _createIndices(widthSegments, heightSegments, zMap) {
    const gridX = Math.floor(widthSegments);
    const gridY = Math.floor(heightSegments);
    const gridX1 = gridX + 1;
    const gridY1 = gridY + 1;

    const indices = ZMapGeometry._indicesBuffer;
    let currentIndex = 0;
    const indexMap = [];
    for (let iy = 0; iy < gridY1 + padding * 2; iy++) {
      const indexMapRow = [];
      for (let ix = 0; ix < gridX1 + padding * 2; ix++) {
        indexMapRow.push(null);
      }
      indexMap.push(indexMapRow);
    }

    let indexCount;
    [currentIndex, indexCount] = this._writeIndices(indices, zMap, gridX1, 0 + padding, 0 + padding, gridX1, gridY1, indexMap, currentIndex);
    this.index = new THREE.BufferAttribute(indices.slice(0, indexCount), 1);
    this._zMap = zMap;
    this._indexMap = indexMap;
    this._currentIndex = currentIndex;
  }

  createVertices() {
    const zMap = this._zMap;
    const indexMap = this._indexMap;
    const currentIndex = this._currentIndex;
    const width_half = this.parameters.width / 2;
    const height_half = this.parameters.height / 2;
    const gridX = Math.floor(this.parameters.widthSegments);
    const gridY = Math.floor(this.parameters.heightSegments);
    const gridX1 = gridX + 1;
    const gridY1 = gridY + 1;
    const segment_width = this.parameters.width / (gridX - 1);
    const segment_height = this.parameters.height / (gridY - 1);

    const vba = new THREE.Float32BufferAttribute(currentIndex * 3, 3);
    const nba = new THREE.Float32BufferAttribute(currentIndex * 3, 3);
    // const uba = new THREE.Float32BufferAttribute(currentIndex * 2, 2);
    const vertices = vba.array;
    const normals = nba.array;
    // const uvs = uba.array;

    for (let iy = 0; iy < gridY1; iy++) {
      const y = (iy === 0 ? 0 : iy === gridY ? gridY - 1 : iy - 0.5) * segment_height - height_half;
      const iy1 = iy + padding;

      for (let ix = 0; ix < gridX1; ix++) {
        const x = (ix === 0 ? 0 : ix === gridX ? gridX - 1 : ix - 0.5) * segment_width - width_half;
        const ix1 = ix + padding;

        const i = indexMap[iy1][ix1];
        if (i === null) { continue; }
        // const i = iy * gridX1 + ix;
        vertices[i * 3 + 0] = x;
        vertices[i * 3 + 1] = -y;
        if (iy === 0) {
          if (ix === 0) {
            vertices[i * 3 + 2] = (zMap[iy1][ix1 + 1] + zMap[iy1 + 1][ix1]) / 2;  //
          } else if (ix === gridX) {
            vertices[i * 3 + 2] = (zMap[iy1][ix1] + zMap[iy1 + 1][ix1 - 1]) / 2;
          } else {
            vertices[i * 3 + 2] = (zMap[iy1][ix1] + zMap[iy1 + 1][ix1]) / 2;
          }
        } else if (iy === gridY) {
          if (ix === 0) {
            vertices[i * 3 + 2] = (zMap[iy1][ix1] + zMap[iy1 - 1][ix1 + 1]) / 2;
          } else if (ix === gridX) {
            vertices[i * 3 + 2] = (zMap[iy1][ix1 - 1] + zMap[iy1 - 1][ix1]) / 2;  //
          } else {
            vertices[i * 3 + 2] = (zMap[iy1][ix1] + zMap[iy1 - 1][ix1]) / 2;
          }
        } else {
          if (ix === 0) {
            vertices[i * 3 + 2] = (zMap[iy1][ix1] + zMap[iy1][ix1 + 1]) / 2;
          } else if (ix === gridX) {
            vertices[i * 3 + 2] = (zMap[iy1][ix1] + zMap[iy1][ix1 - 1]) / 2;
          } else {
            vertices[i * 3 + 2] = zMap[iy1][ix1];
          }
        }
        // normals[i * 3 + 0] = 0;
        // normals[i * 3 + 1] = 0;
        // normals[i * 3 + 2] = 0;
        // uvs[i * 2 + 0] = ix / gridX;
        // uvs[i * 2 + 1] = 1 - iy / gridY;
      }
    }

    if (OPTIMIZE_COMPUTE_NORMALS) {
      this.computeVertexNormalsWithBorder(normals, vertices, this.index.array, indexMap, zMap, 1 + padding, 1 + padding, gridX1 + padding - 2, gridY1 + padding - 2, segment_width, segment_height);
    }

    this.setAttribute('position', vba);
    this.setAttribute('normal', nba);
    // this.setAttribute('uv', uba);

    if (OPTIMIZE_COMPUTE_NORMALS && !OPTIMIZE_NORMALIZE_NORMALS) {
      this.normalizeNormals();
      this.attributes.normal.needsUpdate = true;
    }

    delete this._zMap;
    delete this._indexMap;
    delete this._currentIndex;
  }

  computeVertexNormalsWithBorder(normals, vertices, indices, indexMap, zMap, startX, startY, stopX, stopY, sw, sh) {
    for (let i = 0; i < indices.length; i += 3) {
      const vA = indices[i + 0] * 3;
      const vB = indices[i + 1] * 3;
      const vC = indices[i + 2] * 3;
      const ax = vertices[vA + 0],  ay = vertices[vA + 1],  az = vertices[vA + 2];
      const bx = vertices[vB + 0],  by = vertices[vB + 1],  bz = vertices[vB + 2];
      const cx = vertices[vC + 0],  cy = vertices[vC + 1],  cz = vertices[vC + 2];
      const cbx = cx - bx,  cby = cy - by,  cbz = cz - bz;
      const abx = ax - bx,  aby = ay - by,  abz = az - bz;
      const x = cby * abz - cbz * aby;
      const y = cbz * abx - cbx * abz;
      const z = cbx * aby - cby * abx;
      normals[vA + 0] += x; normals[vA + 1] += y; normals[vA + 2] += z;
      normals[vB + 0] += x; normals[vB + 1] += y; normals[vB + 2] += z;
      normals[vC + 0] += x; normals[vC + 1] += y; normals[vC + 2] += z;
    }


    let nx, ny, nz;

    function vertex(ix, iy) {
      {
        const ax = -sw, ay =   0, az = zMap[iy    ][ix - 1];
        const bx =   0, by =   0, bz = zMap[iy    ][ix    ];
        const cx =   0, cy =  sh, cz = zMap[iy - 1][ix    ];
        const cbx = cx - bx,  cby = cy - by,  cbz = cz - bz;
        const abx = ax - bx,  aby = ay - by,  abz = az - bz;
        const x = cby * abz - cbz * aby;
        const y = cbz * abx - cbx * abz;
        const z = cbx * aby - cby * abx;
        nx += x;  ny += y;  nz += z;
      }
      {
        const ax =   0, ay =  sh, az = zMap[iy - 1][ix    ];
        const bx =   0, by =   0, bz = zMap[iy    ][ix    ];
        const cx =  sw, cy =  sh, cz = zMap[iy - 1][ix + 1];
        const cbx = cx - bx,  cby = cy - by,  cbz = cz - bz;
        const abx = ax - bx,  aby = ay - by,  abz = az - bz;
        const x = cby * abz - cbz * aby;
        const y = cbz * abx - cbx * abz;
        const z = cbx * aby - cby * abx;
        nx += x;  ny += y;  nz += z;
      }
      {
        const ax =   0, ay =   0, az = zMap[iy    ][ix    ];
        const bx =  sw, by =   0, bz = zMap[iy    ][ix + 1];
        const cx =  sw, cy =  sh, cz = zMap[iy - 1][ix + 1];
        const cbx = cx - bx,  cby = cy - by,  cbz = cz - bz;
        const abx = ax - bx,  aby = ay - by,  abz = az - bz;
        const x = cby * abz - cbz * aby;
        const y = cbz * abx - cbx * abz;
        const z = cbx * aby - cby * abx;
        nx += x;  ny += y;  nz += z;
      }
      {
        const ax = -sw, ay =   0, az = zMap[iy    ][ix - 1];
        const bx = -sw, by = -sh, bz = zMap[iy + 1][ix - 1];
        const cx =   0, cy =   0, cz = zMap[iy    ][ix    ];
        const cbx = cx - bx,  cby = cy - by,  cbz = cz - bz;
        const abx = ax - bx,  aby = ay - by,  abz = az - bz;
        const x = cby * abz - cbz * aby;
        const y = cbz * abx - cbx * abz;
        const z = cbx * aby - cby * abx;
        nx += x;  ny += y;  nz += z;
      }
      {
        const ax = -sw, ay = -sh, az = zMap[iy + 1][ix - 1];
        const bx =   0, by = -sh, bz = zMap[iy + 1][ix    ];
        const cx =   0, cy =   0, cz = zMap[iy    ][ix    ];
        const cbx = cx - bx,  cby = cy - by,  cbz = cz - bz;
        const abx = ax - bx,  aby = ay - by,  abz = az - bz;
        const x = cby * abz - cbz * aby;
        const y = cbz * abx - cbx * abz;
        const z = cbx * aby - cby * abx;
        nx += x;  ny += y;  nz += z;
      }
      {
        const ax =   0, ay =   0, az = zMap[iy    ][ix    ];
        const bx =   0, by = -sh, bz = zMap[iy + 1][ix    ];
        const cx =  sw, cy =   0, cz = zMap[iy    ][ix + 1];
        const cbx = cx - bx,  cby = cy - by,  cbz = cz - bz;
        const abx = ax - bx,  aby = ay - by,  abz = az - bz;
        const x = cby * abz - cbz * aby;
        const y = cbz * abx - cbx * abz;
        const z = cbx * aby - cby * abx;
        nx += x;  ny += y;  nz += z;
      }
    }

    function corner(x, y, dx, dy) {
      nx = 0; ny = 0; nz = 0;
      vertex(x, y);
      vertex(x + dx, y);
      vertex(x, y + dy);
      vertex(x + dx, y + dy);
      const i = indexMap[y + dy][x + dx] * 3;
      normals[i + 0] = nx;
      normals[i + 1] = ny;
      normals[i + 2] = nz;
    }

    function sideLR(x, dx) {
      for (let iy = startY; iy <= stopY; iy++) {
        nx = 0; ny = 0; nz = 0;
        {
          vertex(x, iy);
          const i = indexMap[iy][x] * 3;
          normals[i + 0] = nx;
          normals[i + 1] = ny;
          normals[i + 2] = nz;
        }
        {
          vertex(x + dx, iy);
          const i = indexMap[iy][x + dx] * 3;
          normals[i + 0] = nx;
          normals[i + 1] = ny;
          normals[i + 2] = nz;
        }
      }
    }

    function sideTB(y, dy) {
      for (let ix = startX; ix <= stopX; ix++) {
        nx = 0; ny = 0; nz = 0;
        {
          vertex(ix, y);
          const i = indexMap[y][ix] * 3;
          normals[i + 0] = nx;
          normals[i + 1] = ny;
          normals[i + 2] = nz;
        }
        {
          vertex(ix, y + dy);
          const i = indexMap[y + dy][ix] * 3;
          normals[i + 0] = nx;
          normals[i + 1] = ny;
          normals[i + 2] = nz;
        }
      }
    }

    corner(startX, startY, -1, -1);
    corner( stopX, startY, +1, -1);
    corner( stopX,  stopY, +1, +1);
    corner(startX,  stopY, -1, +1);

    sideLR(startX, -1);
    sideLR( stopX, +1);

    sideTB(startY, -1);
    sideTB( stopY, +1);


    if (OPTIMIZE_NORMALIZE_NORMALS) {
      const n = new THREE.Vector3();
      for (let i = 0; i < normals.length; i += 3) {
        n.x = normals[i + 0];
        n.y = normals[i + 1];
        n.z = normals[i + 2];

        n.normalize();

        normals[i + 0] = n.x;
        normals[i + 1] = n.y;
        normals[i + 2] = n.z;
      }
    }
  }

  _writeIndices(indices, zMap, gridX1, x, y, width, height, indexMap, currentIndex) {
    const jumpMap = [];
    for (let iy = 0; iy < height; iy++) {
      jumpMap.push([]);
    }

    let index = 0;

    for (let iy = y; iy < y + height - 1; iy++) {
      for (let ix = x; ix < x + width - 1; ix++) {
        if (jumpMap[iy - y][ix - x]) {
          ix = jumpMap[iy - y][ix - x] - 1;
          continue;
        }

        let ix2 = ix + 1;
        let iy2 = iy + 1;
        const z = zMap[iy][ix];
        if (ix > x && ix2 + 2 < x + width && iy > y && iy2 + 2 < y + height &&
            zMap[iy - 1][ix - 1] === z && zMap[iy - 1][ix] === z && zMap[iy - 1][ix2] === z && zMap[iy - 1][ix2 + 1] === z &&
            zMap[iy    ][ix - 1] === z &&                           zMap[iy    ][ix2] === z && zMap[iy    ][ix2 + 1] === z &&
            zMap[iy + 1][ix - 1] === z && zMap[iy + 1][ix] === z && zMap[iy + 1][ix2] === z && zMap[iy + 1][ix2 + 1] === z &&
            zMap[iy + 2][ix - 1] === z && zMap[iy + 2][ix] === z && zMap[iy + 2][ix2] === z && zMap[iy + 2][ix2 + 1] === z) {
          let stopX = false;
          let stopY = false;
          do {
            if (!stopX && ix2 % 50 === padding) { stopX = true; }
            if (!stopX) {
              if (jumpMap[iy - y][ix2 - x]) {
                stopX = true;
              }
            }
            if (!stopX) {
              for (let iy3 = iy - 1; iy3 < iy2 + 2; iy3++) {
                if (zMap[iy3][ix2 + 2] !== z) {
                  stopX = true;
                  break;
                }
              }
            }
            if (!stopX) {
              ix2++;
              if (ix2 + 2 >= x + width) {
                stopX = true;
              }
            }

            if (!stopY && iy2 % 50 === padding) { stopY = true; }
            if (!stopY) {
              for (let ix3 = ix - 1; ix3 < ix2 + 2; ix3++) {
                if (zMap[iy2 + 2][ix3] !== z) {
                  stopY = true;
                  break;
                }
              }
            }
            if (!stopY) {
              iy2++;
              if (iy2 + 2 >= y + height) {
                stopY = true;
              }
            }
          } while (!stopX || !stopY);

          for (let iy3 = iy + 1; iy3 < iy2; iy3++) {
            jumpMap[iy3 - y][ix - x] = ix2;
          }
        }

        // const a = ix + gridX1 * iy;
        // const b = ix + gridX1 * iy2;
        // const c = ix2 + gridX1 * iy2;
        // const d = ix2 + gridX1 * iy;
        const a = (indexMap[iy ][ix ] ?? (indexMap[iy ][ix ] = currentIndex++));
        const b = (indexMap[iy2][ix ] ?? (indexMap[iy2][ix ] = currentIndex++));
        const c = (indexMap[iy2][ix2] ?? (indexMap[iy2][ix2] = currentIndex++));
        const d = (indexMap[iy ][ix2] ?? (indexMap[iy ][ix2] = currentIndex++));
        indices[index + 0] = a;
        indices[index + 1] = b;
        indices[index + 2] = d;
        indices[index + 3] = b;
        indices[index + 4] = c;
        indices[index + 5] = d;
        index += 6;
        ix = ix2 - 1;
      }
    }

    return [currentIndex, index];
  }

}
