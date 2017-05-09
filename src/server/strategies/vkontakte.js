import Vkontakte from 'passport-vkontakte';
import fetch from 'isomorphic-fetch';
export default (ctx, module) => {

  const { Strategy } = module;
  return class VkAuth extends Strategy {
    Strategy = Vkontakte.Strategy
    providerName = 'vkontakte'
    updateConfig(config) {
      if (!config.callbackURL) {
        config.callbackURL = `${ctx.config.url}/api/module/auth/vkontakte/callback`;
      }
      return config;
    }
    async getExtraData({ accessToken, refreshToken, profile }) {
      const { fields = [
        'sex',
        'bdate',
        'city',
        'country',
        'photo_50',
        'photo_100',
        'photo_200',
        'photo_max_orig',
        'photo_max',
      ] } = ctx.config.auth.socials.vkontakte;
      const res = await fetch(
        `https://api.vk.com/method/users.get?fields=${fields.join(',')}&access_token=${accessToken}`,
      );
      const json = await res.json();
      return json.response[0];
    }
    async createPassport({ accessToken, refreshToken, profile, extraData = {}, providerId }) {
      const { Passport } = ctx.modules.auth.models;
      const data = {
        provider: this.providerName,
        providerId,
        raw: extraData,
        token: accessToken,
        profile: {
          firstName: extraData.first_name,
          lastName: extraData.last_name,
          gender: extraData.sex === 1 ? 'female' : 'male',
          photos: [
            extraData.photo_50,
            extraData.photo_100,
            extraData.photo_200,
            extraData.photo_max,
            extraData.photo_max_orig,
          ],
          avatar: extraData.photo_200,
          city: extraData.city,
          country: extraData.country,
        },
      };
      const passport = new Passport(data);
      return passport.save();
    }
  };
};
