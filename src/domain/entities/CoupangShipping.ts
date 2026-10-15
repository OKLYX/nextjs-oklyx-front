import type { ShippingConfig, ShippingConfigRequest } from '@/domain/entities/ShippingEntity';

// Coupang sales channel shipping default as form values (FEATURE_2610_16 / D29 · D31): the empty form and the
// stored-config → form mapping, used by the sales channel info / edit modals' 「배송」 tab. Moved unchanged out of the
// old [배송관리] modal file, which this change deletes.
export const EMPTY_FORM: ShippingConfigRequest = {
  outboundShippingPlaceCode: null,
  returnCenterCode: null,
  returnChargeName: null,
  returnContactNumber: null,
  returnZipCode: null,
  returnAddress: null,
  returnAddressDetail: null,
  returnCharge: null,
  deliveryChargeOnReturn: null,
  deliveryMethod: null,
  deliveryCompanyCode: null,
  deliveryChargeType: null,
  deliveryCharge: null,
  freeShipOverAmount: null,
  remoteAreaDeliverable: null,
  unionDeliveryType: null,
  extraInfoMessage: null,
};

export function toForm(c: ShippingConfig): ShippingConfigRequest {
  return {
    outboundShippingPlaceCode: c.outboundShippingPlaceCode,
    returnCenterCode: c.returnCenterCode,
    returnChargeName: c.returnChargeName,
    returnContactNumber: c.returnContactNumber,
    returnZipCode: c.returnZipCode,
    returnAddress: c.returnAddress,
    returnAddressDetail: c.returnAddressDetail,
    returnCharge: c.returnCharge,
    deliveryChargeOnReturn: c.deliveryChargeOnReturn,
    deliveryMethod: c.deliveryMethod,
    deliveryCompanyCode: c.deliveryCompanyCode,
    deliveryChargeType: c.deliveryChargeType,
    deliveryCharge: c.deliveryCharge,
    freeShipOverAmount: c.freeShipOverAmount,
    remoteAreaDeliverable: c.remoteAreaDeliverable,
    unionDeliveryType: c.unionDeliveryType,
    extraInfoMessage: c.extraInfoMessage,
  };
}
