import get from 'lodash/get';
import forEach from 'lodash/forEach';
import { Passport } from 'passport';
import onlineService from './server/onlineService';

export default (ctx) => {
  return class AuthModule {
    canonize = require('./server/canonize').default.bind(this)
    canonizeAndValidatePhone = require('./server/canonizeAndValidatePhone').default.bind(this)
    canonizePhone = require('./server/canonizePhone').default.bind(this)
    canonizeUsername = require('./server/canonizeUsername').default.bind(this)
    transliterate = require('./server/transliterate').default.bind(this)

    initOnlineService() {
      this.online = onlineService;
      this.online.save = async (_id, visitedAt) => {
        // console.log('this.online.save', _id, visitedAt);
        const { User } = ctx.models;
        await User.update({ _id }, { visitedAt });
      };
      // setInterval(() => {
      //   console.log('online users', this.online.count());
      // }, 10000);
      ctx.middlewares.parseUser = [
        ctx.middlewares.parseUser,
        (req, res, next) => {
          // console.log('!req.headers.offline', !req.headers.offline, req.headers.offline, req.headers);
          if (req.user && req.user._id && !req.headers.offline) {
            this.online.touchOnline(req.user._id);
          }
          next();
        },
      ];
    }
    getModels() {
      return require('./server/models').default(ctx, this);
    }
    getController() {
      return require('./server/controller').default(ctx, this);
    }
    getStrategies() {
      return require('./server/strategies').default(ctx, this);
    }
    async init() {
      this.config = get(ctx, 'config.auth', {});

      if (this.config.telegram) {
        this.tbot = require('./tbot').default(ctx, this);
      }
      if (!this.config.socials) this.config.socials = {};
      this.initOnlineService();
      this.models = this.getModels();
      ctx.models.User = this.models.User;

      this.controller = this.getController();
      this.Strategy = require('./server/Strategy').default(ctx, this);
      this.strategies = this.getStrategies();
      this._strategies = {};
      this.passport = new Passport();
    }
    async run() {
      // this.strategies = require('./strategies').default(ctx, this);
      // const { strategies } = this || {};
      forEach(this.strategies, (Strategy) => {
        if (!Strategy) return null;
        const strategy = new Strategy();
        // console.log({strategy});
        if (!strategy) return null;
        const { providerName } = strategy;
        // console.log({providerName});
        if (!this.config.socials[providerName]) return null;
        this._strategies[providerName] = strategy;
        this.passport.use(strategy.getStrategy(strategy));
      });
      ctx.log.trace('auth strategies', Object.keys(this._strategies));
      // if (this.strategies) {
      //   forEach(this.strategies || [], (strategy) => {
      //     this.passport.use(strategy.getStrategy(strategy));
      //   });
      // }
      // ctx.app.use('/api/module/auth', require('./api/auth'));
      ctx.app.use('/api/module/auth', this.getApi());
    }


    getApi() {
      const api = ctx.asyncRouter();
      const { isAuth } = ctx.middlewares;

      api.all('/login', this.controller.login);
      api.post('/signup', this.controller.signup);
      api.all('/recovery', this.controller.recovery);
      api.all('/updateToken', this.controller.updateToken);
      api.all('/loginToken', this.controller.loginToken);
      api.all('/email/approve', this.controller.emailApprove, (req, res) => {
        return res.redirect('/cabinet');
      });
      api.all('/phone/code', this.controller.phoneCode);
      api.all('/phone/approve', this.controller.phoneApprove);
      api.all('/phone/login', this.controller.phoneLogin);

      // Регистрация пользователя через соц сеть
      api.all('/social', isAuth, this.controller.getSocials);
      api.all('/social/signup', this.controller.socialLogin);
      api.all('/social/login', this.controller.socialLogin);
      api.all('/social/bind', isAuth, this.controller.socialBind); // Добавление соц.сетей к пользователю
      api.all('/social/unbind', isAuth, this.controller.socialUnbind);

      // social auth init
      api.get('/:provider', this.controller.socialAuth);
      api.get('/:provider/auth', this.controller.socialAuth);
      api.get('/:provider/callback', this.controller.socialCallback);

      return api;
    }
  };
};
