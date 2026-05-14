import Capacitor
import Foundation

@objc(ICloudSyncPlugin)
class ICloudSyncPlugin: CAPPlugin, CAPBridgedPlugin {
    let identifier = "ICloudSyncPlugin"
    let jsName = "ICloudSync"
    let pluginMethods: [CAPPluginMethod] = [
        CAPPluginMethod(name: "isAvailable", returnType: CAPPluginReturnPromise),
        CAPPluginMethod(name: "get", returnType: CAPPluginReturnPromise),
        CAPPluginMethod(name: "set", returnType: CAPPluginReturnPromise),
        CAPPluginMethod(name: "remove", returnType: CAPPluginReturnPromise)
    ]

    private let store = NSUbiquitousKeyValueStore.default
    private let maxPayloadBytes = 900_000

    @objc func isAvailable(_ call: CAPPluginCall) {
        call.resolve([
            "available": FileManager.default.ubiquityIdentityToken != nil
        ])
    }

    @objc func get(_ call: CAPPluginCall) {
        guard let key = call.getString("key"), !key.isEmpty else {
            call.reject("key is required")
            return
        }

        store.synchronize()
        call.resolve([
            "value": store.string(forKey: key) as Any,
            "updatedAt": store.string(forKey: "\(key).updatedAt") as Any
        ])
    }

    @objc func set(_ call: CAPPluginCall) {
        guard let key = call.getString("key"), !key.isEmpty else {
            call.reject("key is required")
            return
        }
        guard let value = call.getString("value") else {
            call.reject("value is required")
            return
        }
        guard value.lengthOfBytes(using: .utf8) <= maxPayloadBytes else {
            call.reject("iCloud key-value payload is too large for sync")
            return
        }

        let updatedAt = ISO8601DateFormatter().string(from: Date())
        store.set(value, forKey: key)
        store.set(updatedAt, forKey: "\(key).updatedAt")
        let synced = store.synchronize()

        call.resolve([
            "synced": synced,
            "updatedAt": updatedAt
        ])
    }

    @objc func remove(_ call: CAPPluginCall) {
        guard let key = call.getString("key"), !key.isEmpty else {
            call.reject("key is required")
            return
        }

        store.removeObject(forKey: key)
        store.removeObject(forKey: "\(key).updatedAt")
        let synced = store.synchronize()
        call.resolve(["synced": synced])
    }
}
