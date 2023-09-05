import { open, writeFile } from 'node:fs/promises';

async function main() {
  const schema = 'create table User(id Int name Char(10) surname Char(10) bd Date)';
  const insert = 'inser into User(id, name, surname, bd)';
  const select = 'select * from User where id = 1';
  

  const user = new Uint8Array(Buffer.from('1 Bogdan Babitskiy 25.08.1999'));
  const fd = await open('storage.txt', 'a');

  await writeFile(fd, user);
}

main();




