// Лаб 5: Postman collection v2.1 үүсгэгч. Хэрэглээ:
//   node scripts/gen-collection.js            -> lab05-collection.json
//   node scripts/gen-collection.js --fail     -> lab05-collection-fail.json (S01-ийн статусыг зориуд 200 гэж хүлээнэ)
const fs = require('fs');
const FAIL = process.argv.includes('--fail');

// Спецификац бүр өөрийн ID-тай (setup ба POST нэг ID ашиглана) -> тест бүр бие даасан
const specs = [
  { id: 'S01', name: 'Амжилттай бүртгэл (идэвхтэй оюутан, урьдач хангасан)',
    student: { id: 'LAB5_S01_STU', status: 'active', taken: ['CS201'] },
    course: { id: 'LAB5_S01_CRS', prereq: ['CS201'] },
    post: { status: 201, result: 'OK', regId: true } },
  { id: 'S02', name: 'Оюутан байхгүй үед ERROR_NO_STUDENT',
    student: null,
    course: { id: 'LAB5_S02_CRS', prereq: [] },
    postIds: { student: 'LAB5_S02_NOSTU', course: 'LAB5_S02_CRS' },
    post: { status: 200, result: 'ERROR_NO_STUDENT' } },
  { id: 'S03', name: 'Идэвхгүй оюутан бүртгүүлэхэд ERROR_INACTIVE_STUDENT',
    student: { id: 'LAB5_S03_STU', status: 'inactive', taken: ['CS201'] },
    course: { id: 'LAB5_S03_CRS', prereq: ['CS201'] },
    post: { status: 200, result: 'ERROR_INACTIVE_STUDENT' } },
  { id: 'S04', name: 'Хичээл байхгүй үед ERROR_NO_COURSE',
    student: { id: 'LAB5_S04_STU', status: 'active', taken: ['CS201'] },
    course: null,
    postIds: { student: 'LAB5_S04_STU', course: 'LAB5_S04_NOCRS' },
    post: { status: 200, result: 'ERROR_NO_COURSE' } },
  { id: 'S05', name: 'Урьдач нөхцөл огт хангаагүй үед ERROR_PREREQUISITES (missing CS201)',
    student: { id: 'LAB5_S05_STU', status: 'active', taken: [] },
    course: { id: 'LAB5_S05_CRS', prereq: ['CS201'] },
    post: { status: 200, result: 'ERROR_PREREQUISITES', missing: ['CS201'] } },
  { id: 'S06', name: 'Урьдач нөхцөл хагас хангагдсан үед зөвхөн дутууг жагсаана (missing CS202)',
    student: { id: 'LAB5_S06_STU', status: 'active', taken: ['CS201'] },
    course: { id: 'LAB5_S06_CRS', prereq: ['CS201', 'CS202'] },
    post: { status: 200, result: 'ERROR_PREREQUISITES', missing: ['CS202'] } },
  { id: 'S07', name: 'Хязгаар: урьдач нөхцөлгүй хичээл, хоосон coursesTaken -> 201',
    student: { id: 'LAB5_S07_STU', status: 'active', taken: [] },
    course: { id: 'LAB5_S07_CRS', prereq: [] },
    post: { status: 201, result: 'OK', regId: true } },
  { id: 'S08', name: 'Давхар алдаа: оюутан ба хичээл хоёулаа байхгүй -> ERROR_NO_STUDENT',
    student: null, course: null,
    postIds: { student: 'LAB5_S08_NOSTU', course: 'LAB5_S08_NOCRS' },
    post: { status: 200, result: 'ERROR_NO_STUDENT' } },
  { id: 'S09', name: 'Давхар алдаа: идэвхгүй оюутан + хичээл байхгүй -> ERROR_INACTIVE_STUDENT',
    student: { id: 'LAB5_S09_STU', status: 'inactive', taken: [] },
    course: null,
    postIds: { student: 'LAB5_S09_STU', course: 'LAB5_S09_NOCRS' },
    post: { status: 200, result: 'ERROR_INACTIVE_STUDENT' } },
  { id: 'S10', name: 'Давхар алдаа: идэвхгүй оюутан + урьдач дутуу -> ERROR_INACTIVE_STUDENT',
    student: { id: 'LAB5_S10_STU', status: 'inactive', taken: [] },
    course: { id: 'LAB5_S10_CRS', prereq: ['CS201'] },
    post: { status: 200, result: 'ERROR_INACTIVE_STUDENT' } },
  { id: 'S11', name: 'Давхар алдаа: оюутан байхгүй + урьдач нөхцөлтэй хичээл -> ERROR_NO_STUDENT',
    student: null,
    course: { id: 'LAB5_S11_CRS', prereq: ['CS201'] },
    postIds: { student: 'LAB5_S11_NOSTU', course: 'LAB5_S11_CRS' },
    post: { status: 200, result: 'ERROR_NO_STUDENT' } },
  { id: 'S12', name: 'Хязгаар: courseID талбар дутуу -> 400 ERROR_BAD_REQUEST',
    student: { id: 'LAB5_S12_STU', status: 'active', taken: [] },
    course: null,
    rawBody: '{"studentID":"LAB5_S12_STU"}',
    post: { status: 400, result: 'ERROR_BAD_REQUEST' } },
  { id: 'S13', name: 'Буруу JSON -> 400 ERROR_BAD_JSON',
    student: null, course: null,
    rawBody: '{bad json',
    post: { status: 400, result: 'ERROR_BAD_JSON' } },
];

const jsonHeader = [{ key: 'Content-Type', value: 'application/json' }];
function url(path) {
  return { raw: '{{baseUrl}}/' + path.join('/'), host: ['{{baseUrl}}'], path };
}
function putReq(name, kind, id, bodyObj) {
  return {
    name,
    event: [{ listen: 'test', script: { type: 'text/javascript', exec: [
      `pm.test(${JSON.stringify(name + ': статус 200')}, function () { pm.response.to.have.status(200); });`,
    ] } }],
    request: { method: 'PUT', header: jsonHeader,
      body: { mode: 'raw', raw: JSON.stringify(bodyObj), options: { raw: { language: 'json' } } },
      url: url([kind, id]) },
  };
}
function postReq(s) {
  let expStatus = s.post.status;
  if (FAIL && s.id === 'S01') expStatus = 200; // зориуд буруу oracle
  const ids = s.postIds || { student: s.student && s.student.id, course: s.course && s.course.id };
  const raw = s.rawBody !== undefined ? s.rawBody
    : JSON.stringify({ studentID: ids.student, courseID: ids.course });
  const t = s.name;
  const exec = [
    `pm.test(${JSON.stringify(t + ' [статус ' + expStatus + ']')}, function () { pm.response.to.have.status(${expStatus}); });`,
    'const body = pm.response.json();',
    `pm.test(${JSON.stringify(t + ' [result=' + s.post.result + ']')}, function () { pm.expect(body.result).to.eql(${JSON.stringify(s.post.result)}); });`,
  ];
  if (s.post.regId) exec.push(`pm.test(${JSON.stringify(t + ' [registrationID тоо]')}, function () { pm.expect(body.registrationID).to.be.a('number'); });`);
  if (s.post.missing) exec.push(`pm.test(${JSON.stringify(t + ' [missing=' + JSON.stringify(s.post.missing) + ']')}, function () { pm.expect(body.missing).to.eql(${JSON.stringify(s.post.missing)}); });`);
  return {
    name: 'POST /registrations',
    event: [{ listen: 'test', script: { type: 'text/javascript', exec } }],
    request: { method: 'POST', header: jsonHeader,
      body: { mode: 'raw', raw, options: { raw: { language: 'json' } } },
      url: url(['registrations']) },
  };
}

const items = specs.map((s) => {
  const reqs = [];
  if (s.student) reqs.push(putReq('Setup: оюутан ' + s.student.id, 'students', s.student.id, { status: s.student.status, coursesTaken: s.student.taken }));
  if (s.course) reqs.push(putReq('Setup: хичээл ' + s.course.id, 'courses', s.course.id, { prerequisites: s.course.prereq }));
  reqs.push(postReq(s));
  return { name: s.id + ' ' + s.name, item: reqs };
});

const col = {
  info: {
    name: FAIL ? 'Lab05 registration API (FAIL: S01 oracle зориуд буруу)' : 'Lab05 registration API',
    schema: 'https://schema.getpostman.com/json/collection/v2.1.0/collection.json',
  },
  variable: [{ key: 'baseUrl', value: 'http://localhost:3000' }],
  item: items,
};
const out = FAIL ? 'lab05-collection-fail.json' : 'lab05-collection.json';
fs.writeFileSync(out, JSON.stringify(col, null, 2) + '\n');
console.log('wrote', out, 'folders:', items.length);
