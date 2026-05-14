import Capacitor
import UIKit

class RecallBridgeViewController: CAPBridgeViewController {
    override func capacitorDidLoad() {
        bridge?.registerPluginInstance(ICloudSyncPlugin())
    }
}
