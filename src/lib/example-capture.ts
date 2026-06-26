// Curated demo sample for the "Load example" button. Trimmed from the
// HandyMenny/uecapabilityparser test data (cli/input/nsgNr.txt) — MIT licensed;
// see test/fixtures/nsg/NOTICE.md for the upstream attribution.

/** Selector label for the demo device. */
export const EXAMPLE_LABEL = 'Example device';

/** A compact real NSG ueCapabilityInformation sample (decodes to NR bands + an NR-CA combo). */
export const EXAMPLE_NSG = `ICD Version : 702
Msg Sequence : 0x0000
Main Command : DM Type 2
Sub Command : Common msg
Stack : Stack 2
Type : 8
Raw Tick : 0x07885D0E
TickTime : 3856.727
Direction : Uplink
ul-dcch -> c1 -> ueCapabilityInformation
 rrc-TransactionIdentifier : 2
 criticalExtensions -> ueCapabilityInformation
  ue-CapabilityRAT-ContainerList
   [0]
    rat-Type : nr
    ue-CapabilityRAT-Container
     accessStratumRelease : rel15
     rf-Parameters
      supportedBandListNR
       [0]
        bandNR : 41
        channelBWs-DL -> fr1
         scs-15kHz : '01110111 00'B(476)
         scs-30kHz : '01110111 11'B(479)
         scs-60kHz : '00000000 00'B(0)
        channelBWs-UL -> fr1
         scs-15kHz : '01110111 00'B(476)
         scs-30kHz : '01110111 11'B(479)
         scs-60kHz : '00000000 00'B(0)
        channelBWs-DL-v1590 -> fr1
         scs-30kHz : '10000000 00000000'B(32768)
        channelBWs-UL-v1590 -> fr1
         scs-30kHz : '10000000 00000000'B(32768)
       [1]
        bandNR : 71
        channelBWs-DL -> fr1
         scs-15kHz : '11110000 00'B(960)
         scs-30kHz : '00000000 00'B(0)
         scs-60kHz : '00000000 00'B(0)
        channelBWs-UL -> fr1
         scs-15kHz : '11110000 00'B(960)
         scs-30kHz : '00000000 00'B(0)
         scs-60kHz : '00000000 00'B(0)
      supportedBandCombinationList
       [0]
        bandList
         [0] -> nr
          bandNR : 41
          ca-BandwidthClassDL-NR : a
         [1] -> nr
          bandNR : 71
          ca-BandwidthClassDL-NR : a
          ca-BandwidthClassUL-NR : a
        featureSetCombination : 0
        ca-ParametersNR
         simultaneousRxTxInterBandCA : supported
         diffNumerologyWithinPUCCH-GroupSmallerSCS : supported
        supportedBandwidthCombinationSet : '1'B(1)
     featureSets
      featureSetsDownlink
       [0]
        featureSetListPerDownlinkCC
         [0] : 1
        intraBandFreqSeparationDL : mhz1200
        scellWithoutSSB : supported
       [1]
        featureSetListPerDownlinkCC
         [0] : 2
        intraBandFreqSeparationDL : mhz1200
        scellWithoutSSB : supported
      featureSetsDownlinkPerCC
       [0]
        supportedSubcarrierSpacingDL : kHz30
        supportedBandwidthDL -> fr1 : mhz100
        channelBW-90mhz : supported
        maxNumberMIMO-LayersPDSCH : fourLayers
        supportedModulationOrderDL : qam256
       [1]
        supportedSubcarrierSpacingDL : kHz15
        supportedBandwidthDL -> fr1 : mhz20
        maxNumberMIMO-LayersPDSCH : twoLayers
        supportedModulationOrderDL : qam256
      featureSetsUplink
       [0]
        featureSetListPerUplinkCC
         [0] : 1
        supportedSRS-Resources
         maxNumberAperiodicSRS-PerBWP : n1
         maxNumberPeriodicSRS-PerBWP : n8
         maxNumberSRS-Ports-PerResource : n1
        twoPUCCH-Group : supported
      featureSetsUplinkPerCC
       [0]
        supportedSubcarrierSpacingUL : kHz15
        supportedBandwidthUL -> fr1 : mhz20
        mimo-CB-PUSCH
         maxNumberMIMO-LayersCB-PUSCH : oneLayer
         maxNumberSRS-ResourcePerSet : 1
        supportedModulationOrderUL : qam256
     featureSetCombinations
      [0]
       [0]
        [0] -> nr
         downlinkSetNR : 1
         uplinkSetNR : 0
       [1]
        [0] -> nr
         downlinkSetNR : 2
         uplinkSetNR : 1`;
