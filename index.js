const { create } = require('xmlbuilder2');
const fs = require('fs');

if (process.argv.length !== 4) {
  console.error('Provide exactly 2 arguments.');
  return;
}

const data = fs.readFileSync(process.argv[2], 'utf-8');

const gj = JSON.parse(fs.readFileSync(process.argv[3], 'utf-8'));

const doc = create(data);

const obj = doc.toObject();

const wayMap = new Map();

for (const way of obj.osm.way) {
  wayMap[way['@id']] = way;
}

let newId = -1;

for (const feature of gj.features) {
  if (feature.type !== 'Feature' || feature.geometry.type !== 'Polygon') {
    console.error('Not a ploygon.');
  }

  const { osm_id: id, full_id, ...restProps } = feature.properties || {};

  let way = wayMap[id];

  if (!way) {
    if (id) {
      console.error(`No object with id=${id} in ${process.argv[2]}.`);

      continue;
    }

    way = {
      '@action': 'modify',
      '@id': newId,
      '@visible': 'true',
      nd: [],
    };

    newId--;

    obj.osm.way.push(way);

    for (const coord of feature.geometry.coordinates[0]) {
      obj.osm.node.push({
        '@lat': coord[1],
        '@lon': coord[0],
        '@action': 'modify',
        '@id': newId,
        '@visible': 'true',
      });

      way.nd.push({
        '@ref': newId,
      });

      newId--;
    }
  }

  const tags = Object.fromEntries(
    (!way.tag
      ? []
      : Array.isArray(way.tag)
      ? way.tag
      : [way.tag]
    ).map((tag) => [tag['@k'], tag['@v']])
  );

  for (let [k, v] of Object.entries(restProps)) {
    // polish some tags
    if (k === 'building:type') {
      k = 'building';
    } else if (k === 'adrr:housename') {
      k = 'name';
    }

    if (v && v !== 'NULL' && tags[k] !== v) {
      tags[k] = v;

      way['@action'] = 'modify';
    }
  }

  way.tag = Object.entries(tags).map(([k, v]) => ({ '@k': k, '@v': v }));
}

console.log(create(obj).end({ prettyPrint: true }));
