import UniversalSchema from 'lego-starter-kit/utils/UniversalSchema';
import jwt from 'jsonwebtoken';
import _ from 'lodash';
export function getSchema(ctx) {
  const mongoose = ctx.db;
  const schema = new UniversalSchema({
    userId: {
      type: mongoose.Schema.Types.ObjectId,
      // ref: 'User',
    },
    // Сырые данные которые пришли из соц сети
    raw: {
      type: Object,
      default: {},
    },
    // Обработанные данные из соцсети
    profile: {
      type: Object, // по идее тут должна быть структура данных
      default: {},
    },
    // Дата последнего обновления данных
    fetchedAt: {
      type: Date,
      default: Date.now,
    },

    // /////

    // название соцсети из passport
    provider: {
      type: String,
      required: true,
    },
    // ID из соцсети
    providerId: { // link to social network
      type: String,
      required: true,
    },
    // token из соцсети
    token: {
      type: String,
    },
    refreshToken: {
      type: String,
    },
    meta: {
      type: Object,
    },
    // статус пасспорта: валиден или нет
    // пока не используется
    status: {
      type: Boolean,
      default: true,
    },
  }, {
    collection: 'passport',
    timestamps: true,
    toJSON: { virtuals: true },
    toObject: { virtuals: true },
  });

  schema.methods.generateUsername = async function () {
    const { User } = ctx.models;
    let username = `${this.providerId}_${this.provider}.com`;
    username = username.toLowerCase();
    let user = await User.findOne({ username });
    // console.log({ user });
    let count = 0;
    while (user) {
      count += 1;
      username += `_${count}`;
      user = await User.findOne({ username }); // eslint-disable-line
    }
    return username;
  };
  schema.methods.getUser = async function () {
    return ctx.models.User.findById(this.userId);
  };

  schema.methods.getIdentity = function (params = {}) {
    const object = _.pick(this.toObject(), ['_id']);
    return Object.assign(object, params);
  };

  schema.methods.generateToken = function (params) {
    return jwt.sign(this.getIdentity(params), ctx.config.jwt.secret);
  };

  schema.statics.decodeToken = function (token) {
    return jwt.verify(token, ctx.config.jwt.secret);
  };

  schema.statics.getByToken = async function (token) {
    const { _id } = this.decodeToken(token);
    return this.findById(_id);
  };

  return schema;
}
// export default getSchema;
//
export default(ctx) => {
  return getSchema(ctx).getMongooseModel(ctx.db);
};
