type DigitalGoodsItemDetails = {
  itemId: string;
  title: string;
  description: string;
  price: {
    currency: string;
    value: string;
  };
};

type DigitalGoodsPurchaseDetails = {
  itemId: string;
  purchaseToken: string;
};

interface DigitalGoodsService {
  getDetails(itemIds: string[]): Promise<DigitalGoodsItemDetails[]>;
  listPurchases(): Promise<DigitalGoodsPurchaseDetails[]>;
  consume(purchaseToken: string): Promise<void>;
}

interface Window {
  getDigitalGoodsService?: (paymentMethod: string) => Promise<DigitalGoodsService>;
}
