#include <napi.h>
#include <wiredtiger.h>
#include <string>
#include <memory>
#include <map>
#include <sstream>
#include <cstdint>

// Static function references for each class
static Napi::FunctionReference *cursorConstructor = nullptr;
static Napi::FunctionReference *sessionConstructor = nullptr;
static Napi::FunctionReference *connectionConstructor = nullptr;

// WiredTigerCursor class (defined first since it's used by WiredTigerSession)
class WiredTigerCursor : public Napi::ObjectWrap<WiredTigerCursor>
{
public:
  static Napi::Object Init(Napi::Env env, Napi::Object exports)
  {
    Napi::Function func = DefineClass(env, "WiredTigerCursor", {
                                                                   InstanceMethod("set", &WiredTigerCursor::Set),
                                                                   InstanceMethod("get", &WiredTigerCursor::Get),
                                                                   InstanceMethod("search", &WiredTigerCursor::Search),
                                                                   InstanceMethod("searchNear", &WiredTigerCursor::SearchNear),
                                                                   InstanceMethod("next", &WiredTigerCursor::Next),
                                                                   InstanceMethod("prev", &WiredTigerCursor::Prev),
                                                                   InstanceMethod("reset", &WiredTigerCursor::Reset),
                                                                   InstanceMethod("insert", &WiredTigerCursor::Insert),
                                                                   InstanceMethod("update", &WiredTigerCursor::Update),
                                                                   InstanceMethod("remove", &WiredTigerCursor::Remove),
                                                                   InstanceMethod("close", &WiredTigerCursor::Close),
                                                                   InstanceMethod("getKey", &WiredTigerCursor::GetRawKey),
                                                                   InstanceMethod("getValue", &WiredTigerCursor::GetRawValue),
                                                                   InstanceMethod("setRawKey", &WiredTigerCursor::SetRawKey),
                                                                   InstanceMethod("setRawValue", &WiredTigerCursor::SetRawValue),
                                                               });

    cursorConstructor = new Napi::FunctionReference();
    *cursorConstructor = Napi::Persistent(func);
    exports.Set("WiredTigerCursor", func);
    return exports;
  }

  static Napi::Object NewInstance(Napi::Env env, WT_CURSOR *cursor, WT_SESSION *session)
  {
    Napi::EscapableHandleScope scope(env);
    Napi::Object obj = cursorConstructor->New({});
    WiredTigerCursor *wrapper = Napi::ObjectWrap<WiredTigerCursor>::Unwrap(obj);
    wrapper->cursor_ = cursor;
    wrapper->session_ = session;
    return scope.Escape(napi_value(obj)).ToObject();
  }

  WiredTigerCursor(const Napi::CallbackInfo &info)
      : Napi::ObjectWrap<WiredTigerCursor>(info), cursor_(nullptr), session_(nullptr)
  {
  }

  ~WiredTigerCursor()
  {
    if (cursor_)
    {
      cursor_->close(cursor_);
    }
  }

private:
  WT_CURSOR *cursor_;
  WT_SESSION *session_;
  // Keep strings alive until insert/update is called
  std::string pending_key_;
  std::string pending_value_;

  Napi::Value Set(const Napi::CallbackInfo &info)
  {
    Napi::Env env = info.Env();

    if (info.Length() < 2 || !info[0].IsString() || !info[1].IsString())
    {
      Napi::TypeError::New(env, "Key and value strings expected").ThrowAsJavaScriptException();
      return env.Null();
    }

    // Store strings as member variables to keep them alive!
    // This is crucial: WiredTiger stores pointers, not copies, so the strings
    // must remain valid until insert()/update() is called
    pending_key_ = info[0].As<Napi::String>().Utf8Value();
    pending_value_ = info[1].As<Napi::String>().Utf8Value();

    // For format 'u' (raw bytes), use WT_ITEM for better performance
    WT_ITEM key_item;
    key_item.data = pending_key_.data();
    key_item.size = pending_key_.size();

    WT_ITEM value_item;
    value_item.data = pending_value_.data();
    value_item.size = pending_value_.size();

    cursor_->set_key(cursor_, &key_item);
    cursor_->set_value(cursor_, &value_item);

    return Napi::Boolean::New(env, true);
  }

  Napi::Value Get(const Napi::CallbackInfo &info)
  {
    Napi::Env env = info.Env();

    WT_ITEM key_item, value_item;

    int ret = cursor_->get_key(cursor_, &key_item);
    if (ret != 0)
    {
      return env.Null();
    }

    ret = cursor_->get_value(cursor_, &value_item);
    if (ret != 0)
    {
      return env.Null();
    }

    // Extract strings from WT_ITEM
    std::string key_str((const char *)key_item.data, key_item.size);
    std::string value_str((const char *)value_item.data, value_item.size);

    Napi::Object result = Napi::Object::New(env);
    result.Set("key", Napi::String::New(env, key_str));
    result.Set("value", Napi::String::New(env, value_str));

    return result;
  }

  Napi::Value Search(const Napi::CallbackInfo &info)
  {
    Napi::Env env = info.Env();

    if (info.Length() < 1 || !info[0].IsString())
    {
      Napi::TypeError::New(env, "Key string expected").ThrowAsJavaScriptException();
      return env.Null();
    }

    std::string key = info[0].As<Napi::String>().Utf8Value();

    // For format 'u' (raw bytes), use WT_ITEM
    WT_ITEM key_item;
    key_item.data = key.data();
    key_item.size = key.size();

    cursor_->set_key(cursor_, &key_item);

    int ret = cursor_->search(cursor_);

    if (ret == 0)
    {
      WT_ITEM value_item;
      cursor_->get_value(cursor_, &value_item);
      // Copy the data immediately - the pointer is only valid until cursor moves!
      std::string value_copy((const char *)value_item.data, value_item.size);
      return Napi::String::New(env, value_copy);
    }
    else if (ret == WT_NOTFOUND)
    {
      return env.Null();
    }
    else
    {
      Napi::Error::New(env, "Search failed: " + std::string(wiredtiger_strerror(ret)))
          .ThrowAsJavaScriptException();
      return env.Null();
    }
  }

  Napi::Value SearchNear(const Napi::CallbackInfo &info)
  {
    Napi::Env env = info.Env();

    if (info.Length() < 1 || !info[0].IsArrayBuffer())
    {
      Napi::TypeError::New(env, "ArrayBuffer expected for searchNear key").ThrowAsJavaScriptException();
      return env.Null();
    }

    Napi::ArrayBuffer keyBuffer = info[0].As<Napi::ArrayBuffer>();
    WT_ITEM key_item;
    key_item.data = keyBuffer.Data();
    key_item.size = keyBuffer.ByteLength();
    cursor_->set_key(cursor_, &key_item);

    int exact;
    int ret = cursor_->search_near(cursor_, &exact);

    if (ret == 0)
    {
      Napi::Object result = Napi::Object::New(env);
      result.Set("exact", Napi::Number::New(env, exact));
      return result;
    }
    else if (ret == WT_NOTFOUND)
    {
      return env.Null();
    }
    else
    {
      Napi::Error::New(env, "search_near failed: " + std::string(wiredtiger_strerror(ret)))
          .ThrowAsJavaScriptException();
      return env.Null();
    }
  }

  Napi::Value Next(const Napi::CallbackInfo &info)
  {
    Napi::Env env = info.Env();

    int ret = cursor_->next(cursor_);

    if (ret == 0)
    {
      // For format 'u' (raw bytes), use WT_ITEM
      WT_ITEM key_item, value_item;

      cursor_->get_key(cursor_, &key_item);
      cursor_->get_value(cursor_, &value_item);

      // Copy data immediately - the pointers are only valid until cursor moves!
      std::string key_copy((const char *)key_item.data, key_item.size);
      std::string value_copy((const char *)value_item.data, value_item.size);

      Napi::Object result = Napi::Object::New(env);
      result.Set("key", Napi::String::New(env, key_copy));
      result.Set("value", Napi::String::New(env, value_copy));
      return result;
    }
    else if (ret == WT_NOTFOUND)
    {
      return env.Null();
    }
    else
    {
      Napi::Error::New(env, "Next failed: " + std::string(wiredtiger_strerror(ret)))
          .ThrowAsJavaScriptException();
      return env.Null();
    }
  }

  Napi::Value GetRawKey(const Napi::CallbackInfo &info)
  {
    Napi::Env env = info.Env();

    WT_ITEM key_item;
    int ret = cursor_->get_key(cursor_, &key_item);
    if (ret != 0)
    {
      return env.Null();
    }

    Napi::ArrayBuffer buffer = Napi::ArrayBuffer::New(env, key_item.size);
    std::memcpy(buffer.Data(), key_item.data, key_item.size);
    return buffer;
  }

  Napi::Value GetRawValue(const Napi::CallbackInfo &info)
  {
    Napi::Env env = info.Env();

    WT_ITEM value_item;
    int ret = cursor_->get_value(cursor_, &value_item);
    if (ret != 0)
    {
      return env.Null();
    }

    Napi::ArrayBuffer buffer = Napi::ArrayBuffer::New(env, value_item.size);
    std::memcpy(buffer.Data(), value_item.data, value_item.size);
    return buffer;
  }

  Napi::Value SetRawKey(const Napi::CallbackInfo &info)
  {
    Napi::Env env = info.Env();

    if (info.Length() < 1 || !info[0].IsArrayBuffer())
    {
      Napi::TypeError::New(env, "ArrayBuffer expected for key").ThrowAsJavaScriptException();
      return env.Null();
    }

    Napi::ArrayBuffer buffer = info[0].As<Napi::ArrayBuffer>();
    WT_ITEM key_item;
    key_item.data = buffer.Data();
    key_item.size = buffer.ByteLength();
    cursor_->set_key(cursor_, &key_item);
    return Napi::Boolean::New(env, true);
  }

  Napi::Value SetRawValue(const Napi::CallbackInfo &info)
  {
    Napi::Env env = info.Env();

    if (info.Length() < 1 || !info[0].IsArrayBuffer())
    {
      Napi::TypeError::New(env, "ArrayBuffer expected for value").ThrowAsJavaScriptException();
      return env.Null();
    }

    Napi::ArrayBuffer buffer = info[0].As<Napi::ArrayBuffer>();
    WT_ITEM value_item;
    value_item.data = buffer.Data();
    value_item.size = buffer.ByteLength();
    cursor_->set_value(cursor_, &value_item);
    return Napi::Boolean::New(env, true);
  }

  Napi::Value Prev(const Napi::CallbackInfo &info)
  {
    Napi::Env env = info.Env();

    int ret = cursor_->prev(cursor_);

    if (ret == 0)
    {
      WT_ITEM key_item, value_item;
      cursor_->get_key(cursor_, &key_item);
      cursor_->get_value(cursor_, &value_item);

      // Extract strings from WT_ITEM
      std::string key_str((const char *)key_item.data, key_item.size);
      std::string value_str((const char *)value_item.data, value_item.size);

      Napi::Object result = Napi::Object::New(env);
      result.Set("key", Napi::String::New(env, key_str));
      result.Set("value", Napi::String::New(env, value_str));
      return result;
    }
    else if (ret == WT_NOTFOUND)
    {
      return env.Null();
    }
    else
    {
      Napi::Error::New(env, "Prev failed: " + std::string(wiredtiger_strerror(ret)))
          .ThrowAsJavaScriptException();
      return env.Null();
    }
  }

  Napi::Value Reset(const Napi::CallbackInfo &info)
  {
    Napi::Env env = info.Env();

    int ret = cursor_->reset(cursor_);
    if (ret != 0)
    {
      Napi::Error::New(env, "Reset failed: " + std::string(wiredtiger_strerror(ret)))
          .ThrowAsJavaScriptException();
      return env.Null();
    }

    return Napi::Boolean::New(env, true);
  }

  Napi::Value Insert(const Napi::CallbackInfo &info)
  {
    Napi::Env env = info.Env();

    int ret = cursor_->insert(cursor_);

    if (ret != 0)
    {
      Napi::Error::New(env, "Insert failed: " + std::string(wiredtiger_strerror(ret)))
          .ThrowAsJavaScriptException();
      return env.Null();
    }

    return Napi::Boolean::New(env, true);
  }

  Napi::Value Update(const Napi::CallbackInfo &info)
  {
    Napi::Env env = info.Env();

    int ret = cursor_->update(cursor_);

    if (ret != 0)
    {
      Napi::Error::New(env, "Update failed: " + std::string(wiredtiger_strerror(ret)))
          .ThrowAsJavaScriptException();
      return env.Null();
    }

    return Napi::Boolean::New(env, true);
  }

  Napi::Value Remove(const Napi::CallbackInfo &info)
  {
    Napi::Env env = info.Env();

    // Key must be set before calling remove
    // The key should already be set by a previous search() or set() call
    int ret = cursor_->remove(cursor_);

    if (ret != 0 && ret != WT_NOTFOUND)
    {
      Napi::Error::New(env, "Remove failed: " + std::string(wiredtiger_strerror(ret)))
          .ThrowAsJavaScriptException();
      return env.Null();
    }

    return Napi::Boolean::New(env, true);
  }

  Napi::Value Close(const Napi::CallbackInfo &info)
  {
    Napi::Env env = info.Env();

    if (cursor_)
    {
      cursor_->close(cursor_);
      cursor_ = nullptr;
    }

    return Napi::Boolean::New(env, true);
  }
};

// WiredTigerSession class (defined second since it's used by WiredTigerConnection)
class WiredTigerSession : public Napi::ObjectWrap<WiredTigerSession>
{
public:
  static Napi::Object Init(Napi::Env env, Napi::Object exports)
  {
    Napi::Function func = DefineClass(env, "WiredTigerSession", {InstanceMethod("createTable", &WiredTigerSession::CreateTable), InstanceMethod("openCursor", &WiredTigerSession::OpenCursor), InstanceMethod("close", &WiredTigerSession::Close), InstanceMethod("beginTransaction", &WiredTigerSession::BeginTransaction), InstanceMethod("commitTransaction", &WiredTigerSession::CommitTransaction), InstanceMethod("rollbackTransaction", &WiredTigerSession::RollbackTransaction), InstanceMethod("openCursorWithConfig", &WiredTigerSession::OpenCursorWithConfig), InstanceMethod("createIndex", &WiredTigerSession::CreateIndex), InstanceMethod("drop", &WiredTigerSession::Drop), InstanceMethod("compact", &WiredTigerSession::Compact)});

    sessionConstructor = new Napi::FunctionReference();
    *sessionConstructor = Napi::Persistent(func);
    exports.Set("WiredTigerSession", func);
    return exports;
  }

  static Napi::Object NewInstance(Napi::Env env, WT_SESSION *session)
  {
    Napi::EscapableHandleScope scope(env);
    Napi::Object obj = sessionConstructor->New({});
    WiredTigerSession *wrapper = Napi::ObjectWrap<WiredTigerSession>::Unwrap(obj);
    wrapper->session_ = session;
    if (session)
    {
      const char *idProperty = "__nativeSessionPtr";
      uintptr_t rawPtr = reinterpret_cast<uintptr_t>(session);
      obj.Set(idProperty, Napi::String::New(env, std::to_string(rawPtr)));
    }
    return scope.Escape(napi_value(obj)).ToObject();
  }

  WiredTigerSession(const Napi::CallbackInfo &info)
      : Napi::ObjectWrap<WiredTigerSession>(info), session_(nullptr)
  {
  }

  ~WiredTigerSession()
  {
    // Session is managed by connection, don't close here
  }

private:
  WT_SESSION *session_;

  Napi::Value CreateTable(const Napi::CallbackInfo &info)
  {
    Napi::Env env = info.Env();

    if (info.Length() < 1 || !info[0].IsString())
    {
      Napi::TypeError::New(env, "String expected for table name").ThrowAsJavaScriptException();
      return env.Null();
    }

    std::string tableName = info[0].As<Napi::String>().Utf8Value();
    std::string config = info.Length() > 1 && info[1].IsString()
                             ? info[1].As<Napi::String>().Utf8Value()
                             : "key_format=S,value_format=S";

    std::string uri = "table:" + tableName;
    int ret = session_->create(session_, uri.c_str(), config.c_str());

    if (ret != 0 && ret != EEXIST)
    {
      Napi::Error::New(env, "Failed to create table: " + std::string(wiredtiger_strerror(ret)))
          .ThrowAsJavaScriptException();
      return env.Null();
    }

    return Napi::Boolean::New(env, true);
  }

  Napi::Value OpenCursor(const Napi::CallbackInfo &info)
  {
    Napi::Env env = info.Env();

    if (info.Length() < 1 || !info[0].IsString())
    {
      Napi::TypeError::New(env, "String expected for table name").ThrowAsJavaScriptException();
      return env.Null();
    }

    std::string tableName = info[0].As<Napi::String>().Utf8Value();
    std::string uri = "table:" + tableName;

    WT_CURSOR *cursor;
    // Open cursor without raw mode - let WiredTiger handle packing/unpacking for format S
    int ret = session_->open_cursor(session_, uri.c_str(), nullptr, nullptr, &cursor);

    if (ret != 0)
    {
      Napi::Error::New(env, "Failed to open cursor: " + std::string(wiredtiger_strerror(ret)))
          .ThrowAsJavaScriptException();
      return env.Null();
    }

    Napi::Object cursorObj = WiredTigerCursor::NewInstance(env, cursor, session_);
    return cursorObj;
  }

  Napi::Value OpenCursorWithConfig(const Napi::CallbackInfo &info)
  {
    Napi::Env env = info.Env();

    if (info.Length() < 1 || !info[0].IsString())
    {
      Napi::TypeError::New(env, "URI string expected for cursor").ThrowAsJavaScriptException();
      return env.Null();
    }

    std::string uri = info[0].As<Napi::String>().Utf8Value();
    std::string config = info.Length() > 1 && info[1].IsString() ? info[1].As<Napi::String>().Utf8Value() : "";

    WT_CURSOR *cursor;
    int ret = session_->open_cursor(session_, uri.c_str(), nullptr, config.empty() ? nullptr : config.c_str(), &cursor);

    if (ret != 0)
    {
      Napi::Error::New(env, "Failed to open cursor: " + std::string(wiredtiger_strerror(ret)))
          .ThrowAsJavaScriptException();
      return env.Null();
    }

    Napi::Object cursorObj = WiredTigerCursor::NewInstance(env, cursor, session_);
    return cursorObj;
  }

  Napi::Value CreateIndex(const Napi::CallbackInfo &info)
  {
    Napi::Env env = info.Env();

    if (info.Length() < 2 || !info[0].IsString() || !info[1].IsString())
    {
      Napi::TypeError::New(env, "URI and config strings expected for createIndex").ThrowAsJavaScriptException();
      return env.Null();
    }

    std::string uri = info[0].As<Napi::String>().Utf8Value();
    std::string config = info[1].As<Napi::String>().Utf8Value();

    int ret = session_->create(session_, uri.c_str(), config.c_str());

    if (ret != 0 && ret != EEXIST)
    {
      Napi::Error::New(env, "Failed to create index: " + std::string(wiredtiger_strerror(ret)))
          .ThrowAsJavaScriptException();
      return env.Null();
    }

    return Napi::Boolean::New(env, true);
  }

  Napi::Value Drop(const Napi::CallbackInfo &info)
  {
    Napi::Env env = info.Env();

    if (info.Length() < 1 || !info[0].IsString())
    {
      Napi::TypeError::New(env, "URI string expected for drop").ThrowAsJavaScriptException();
      return env.Null();
    }

    std::string uri = info[0].As<Napi::String>().Utf8Value();
    std::string config = info.Length() > 1 && info[1].IsString() ? info[1].As<Napi::String>().Utf8Value() : "";

    int ret = session_->drop(session_, uri.c_str(), config.empty() ? nullptr : config.c_str());

    if (ret != 0 && ret != WT_NOTFOUND)
    {
      Napi::Error::New(env, "Failed to drop object: " + std::string(wiredtiger_strerror(ret)))
          .ThrowAsJavaScriptException();
      return env.Null();
    }

    return Napi::Boolean::New(env, true);
  }

  Napi::Value Compact(const Napi::CallbackInfo &info)
  {
    Napi::Env env = info.Env();

    if (info.Length() < 1 || !info[0].IsString())
    {
      Napi::TypeError::New(env, "URI string expected for compact").ThrowAsJavaScriptException();
      return env.Null();
    }

    std::string uri = info[0].As<Napi::String>().Utf8Value();
    std::string config = info.Length() > 1 && info[1].IsString() ? info[1].As<Napi::String>().Utf8Value() : "";

    int ret = session_->compact(session_, uri.c_str(), config.empty() ? nullptr : config.c_str());

    if (ret != 0)
    {
      Napi::Error::New(env, "Failed to compact object: " + std::string(wiredtiger_strerror(ret)))
          .ThrowAsJavaScriptException();
      return env.Null();
    }

    return Napi::Boolean::New(env, true);
  }

  Napi::Value Close(const Napi::CallbackInfo &info)
  {
    Napi::Env env = info.Env();

    if (session_)
    {
      int ret = session_->close(session_, nullptr);
      if (ret != 0)
      {
        Napi::Error::New(env, "Failed to close session: " + std::string(wiredtiger_strerror(ret)))
            .ThrowAsJavaScriptException();
        return env.Null();
      }
      session_ = nullptr;
    }

    return Napi::Boolean::New(env, true);
  }

  Napi::Value BeginTransaction(const Napi::CallbackInfo &info)
  {
    Napi::Env env = info.Env();

    std::string config = info.Length() > 0 && info[0].IsString()
                             ? info[0].As<Napi::String>().Utf8Value()
                             : "";

    int ret = session_->begin_transaction(session_, config.c_str());
    if (ret != 0)
    {
      Napi::Error::New(env, "Failed to begin transaction: " + std::string(wiredtiger_strerror(ret)))
          .ThrowAsJavaScriptException();
      return env.Null();
    }

    return Napi::Boolean::New(env, true);
  }

  Napi::Value CommitTransaction(const Napi::CallbackInfo &info)
  {
    Napi::Env env = info.Env();

    std::string config = info.Length() > 0 && info[0].IsString()
                             ? info[0].As<Napi::String>().Utf8Value()
                             : "";

    int ret = session_->commit_transaction(session_, config.c_str());
    if (ret != 0)
    {
      Napi::Error::New(env, "Failed to commit transaction: " + std::string(wiredtiger_strerror(ret)))
          .ThrowAsJavaScriptException();
      return env.Null();
    }

    return Napi::Boolean::New(env, true);
  }

  Napi::Value RollbackTransaction(const Napi::CallbackInfo &info)
  {
    Napi::Env env = info.Env();

    std::string config = info.Length() > 0 && info[0].IsString()
                             ? info[0].As<Napi::String>().Utf8Value()
                             : "";

    int ret = session_->rollback_transaction(session_, config.c_str());
    if (ret != 0)
    {
      Napi::Error::New(env, "Failed to rollback transaction: " + std::string(wiredtiger_strerror(ret)))
          .ThrowAsJavaScriptException();
      return env.Null();
    }

    return Napi::Boolean::New(env, true);
  }
};

// WiredTigerConnection class (defined last since it uses WiredTigerSession)
class WiredTigerConnection : public Napi::ObjectWrap<WiredTigerConnection>
{
public:
  static Napi::Object Init(Napi::Env env, Napi::Object exports)
  {
    Napi::Function func = DefineClass(env, "WiredTigerConnection", {InstanceMethod("open", &WiredTigerConnection::Open), InstanceMethod("close", &WiredTigerConnection::Close), InstanceMethod("openSession", &WiredTigerConnection::OpenSession), InstanceMethod("checkpoint", &WiredTigerConnection::Checkpoint), InstanceMethod("releaseSession", &WiredTigerConnection::ReleaseSession), InstanceMethod("loadExtension", &WiredTigerConnection::LoadExtension)});

    connectionConstructor = new Napi::FunctionReference();
    *connectionConstructor = Napi::Persistent(func);

    exports.Set("WiredTigerConnection", func);
    return exports;
  }

  WiredTigerConnection(const Napi::CallbackInfo &info)
      : Napi::ObjectWrap<WiredTigerConnection>(info), conn_(nullptr)
  {
  }

  ~WiredTigerConnection()
  {
    CloseInternal();
  }

private:
  WT_CONNECTION *conn_;
  std::map<std::string, WT_SESSION *> sessions_;

  Napi::Value Open(const Napi::CallbackInfo &info)
  {
    Napi::Env env = info.Env();

    if (info.Length() < 1 || !info[0].IsString())
    {
      Napi::TypeError::New(env, "String expected for path").ThrowAsJavaScriptException();
      return env.Null();
    }

    std::string path = info[0].As<Napi::String>().Utf8Value();
    std::string config = info.Length() > 1 && info[1].IsString()
                             ? info[1].As<Napi::String>().Utf8Value()
                             : "create,cache_size=500M";

    int ret = wiredtiger_open(path.c_str(), nullptr, config.c_str(), &conn_);
    if (ret != 0)
    {
      Napi::Error::New(env, "Failed to open WiredTiger connection: " + std::string(wiredtiger_strerror(ret)))
          .ThrowAsJavaScriptException();
      return env.Null();
    }

    return Napi::Boolean::New(env, true);
  }

  Napi::Value Close(const Napi::CallbackInfo &info)
  {
    Napi::Env env = info.Env();

    // Close all sessions first
    for (auto &pair : sessions_)
    {
      if (pair.second)
      {
        pair.second->close(pair.second, nullptr);
      }
    }
    sessions_.clear();

    CloseInternal();

    return Napi::Boolean::New(env, true);
  }

  Napi::Value OpenSession(const Napi::CallbackInfo &info)
  {
    Napi::Env env = info.Env();

    if (!conn_)
    {
      Napi::Error::New(env, "Connection not open").ThrowAsJavaScriptException();
      return env.Null();
    }

    WT_SESSION *session;
    int ret = conn_->open_session(conn_, nullptr, nullptr, &session);
    if (ret != 0)
    {
      Napi::Error::New(env, "Failed to open session: " + std::string(wiredtiger_strerror(ret)))
          .ThrowAsJavaScriptException();
      return env.Null();
    }

    // Create a WiredTigerSession wrapper
    Napi::Object sessionObj = WiredTigerSession::NewInstance(env, session);
    std::string sessionId = sessionObj.Get("__nativeSessionPtr").As<Napi::String>().Utf8Value();
    sessions_[sessionId] = session;
    return sessionObj;
  }

  void CloseInternal()
  {
    for (auto &pair : sessions_)
    {
      if (pair.second)
      {
        pair.second->close(pair.second, nullptr);
      }
    }
    sessions_.clear();

    if (conn_)
    {
      conn_->close(conn_, nullptr);
      conn_ = nullptr;
    }
  }

  Napi::Value Checkpoint(const Napi::CallbackInfo &info)
  {
    Napi::Env env = info.Env();

    if (!conn_)
    {
      Napi::Error::New(env, "Connection not open").ThrowAsJavaScriptException();
      return env.Null();
    }

    // Open a temporary session for checkpoint
    WT_SESSION *session;
    int ret = conn_->open_session(conn_, nullptr, nullptr, &session);
    if (ret != 0)
    {
      Napi::Error::New(env, "Failed to open session for checkpoint: " + std::string(wiredtiger_strerror(ret)))
          .ThrowAsJavaScriptException();
      return env.Null();
    }

    // Run checkpoint
    ret = session->checkpoint(session, nullptr);
    session->close(session, nullptr);

    if (ret != 0)
    {
      Napi::Error::New(env, "Checkpoint failed: " + std::string(wiredtiger_strerror(ret)))
          .ThrowAsJavaScriptException();
      return env.Null();
    }

    return Napi::Boolean::New(env, true);
  }

  Napi::Value LoadExtension(const Napi::CallbackInfo &info)
  {
    Napi::Env env = info.Env();

    if (!conn_)
    {
      Napi::Error::New(env, "Connection not open").ThrowAsJavaScriptException();
      return env.Null();
    }

    if (info.Length() < 1 || !info[0].IsString())
    {
      Napi::TypeError::New(env, "Extension path expected").ThrowAsJavaScriptException();
      return env.Null();
    }

    std::string path = info[0].As<Napi::String>().Utf8Value();
    std::string config = info.Length() > 1 && info[1].IsString() ? info[1].As<Napi::String>().Utf8Value() : "";

    int ret = conn_->load_extension(conn_, path.c_str(), config.empty() ? nullptr : config.c_str());
    if (ret != 0)
    {
      Napi::Error::New(env, "Failed to load extension: " + std::string(wiredtiger_strerror(ret)))
          .ThrowAsJavaScriptException();
      return env.Null();
    }

    return Napi::Boolean::New(env, true);
  }

  Napi::Value ReleaseSession(const Napi::CallbackInfo &info)
  {
    Napi::Env env = info.Env();

    if (info.Length() < 1 || !info[0].IsString())
    {
      Napi::TypeError::New(env, "String expected for session identifier").ThrowAsJavaScriptException();
      return env.Null();
    }

    std::string sessionId = info[0].As<Napi::String>().Utf8Value();
    auto it = sessions_.find(sessionId);
    if (it != sessions_.end())
    {
      sessions_.erase(it);
    }

    return Napi::Boolean::New(env, true);
  }
};

Napi::Object InitAll(Napi::Env env, Napi::Object exports)
{
  WiredTigerCursor::Init(env, exports);
  WiredTigerSession::Init(env, exports);
  WiredTigerConnection::Init(env, exports);
  return exports;
}

NODE_API_MODULE(wiredtiger_native, InitAll)
