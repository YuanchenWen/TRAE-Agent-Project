declare module 'better-sqlite3' {
  interface DatabaseOptions {
    readonly?: boolean
    fileMustExist?: boolean
  }

  export default class Database {
    constructor(filename: string, options?: DatabaseOptions)
    close(): this
  }
}
