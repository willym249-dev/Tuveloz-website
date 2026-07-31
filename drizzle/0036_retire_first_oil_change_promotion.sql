-- Retire the first-oil-change customer-fee promotion without rewriting any
-- quote, checkout, payment, refund, or transfer amount already recorded.
DROP TRIGGER IF EXISTS `account_credentials_first_oil_change_promo`;
--> statement-breakpoint
DROP TRIGGER IF EXISTS `provider_quotes_first_oil_change_promo`;
--> statement-breakpoint
DROP TRIGGER IF EXISTS `stripe_payments_redeem_first_oil_change_insert`;
--> statement-breakpoint
DROP TRIGGER IF EXISTS `stripe_payments_redeem_first_oil_change_update`;
--> statement-breakpoint
UPDATE `account_promotions`
   SET `status` = 'retired',
       `updated_at` = CURRENT_TIMESTAMP
 WHERE `promotion_key` = 'first-oil-change-fee-free'
   AND `status` <> 'redeemed';
--> statement-breakpoint
DELETE FROM `account_notifications`
 WHERE `event_key` LIKE 'promo:first-oil-change:%';
--> statement-breakpoint
UPDATE `account_notifications`
   SET `body` = 'Request vehicle work, compare independent providers and quotes, choose appointments, and follow job updates in one account.'
 WHERE `event_key` LIKE 'welcome:customer:%'
   AND lower(`body`) LIKE '%oil-change%';
--> statement-breakpoint
UPDATE `email_notification_outbox`
   SET `text_body` = replace(
         `text_body`,
         'New-account offer: your first qualifying oil-change request created after your account is eligible for no Tuveloz customer service fee. The provider''s labor, parts, taxes, disposal, travel, and any other provider charges are not waived. The offer is limited to one qualifying oil-change booking per account and applies automatically when eligible.' || char(10) || char(10),
         ''
       ),
       `updated_at` = CURRENT_TIMESTAMP
 WHERE `status` <> 'sent'
   AND `event_key` LIKE 'security:account_created:%'
   AND lower(`text_body`) LIKE '%first qualifying oil-change%';
