// declare a new module called 'myApp', and make it require the `ng-admin` module as a dependency
var qtPayApp = angular.module('qtPayApp', ['ng-admin']);

// declare a function to run when the module bootstraps (during the 'config' phase)
qtPayApp.config(['RestangularProvider',
  function(RestangularProvider) {
    RestangularProvider.addFullRequestInterceptor(function(element, operation, what, url, headers, params) {
      if (operation == "getList") {
        // custom filters
        if (params._filters) {
          for (var filter in params._filters) {
            params[filter] = params._filters[filter];
          }
          delete params._filters;
        }
      }
      return {
        params: params
      };
    });
  }
]);

qtPayApp.config(['NgAdminConfigurationProvider',
  function(nga) {
    // create an admin application
    var admin = nga.application('蜻蜓FM支付管理系统').baseApiUrl('/');

    // some shared vars
    var id_field = nga.field('id').label('ID');

    // Purchase Entity and Item
    var purchase_entity = nga.entity('p_entities').identifier(id_field).label('付费收听项目');
    var purchase_item = nga.entity('p_items').identifier(id_field).label('付费套餐');

    var purchase_entities_contentItems = [
      nga.field('name').label('项目名称').isDetailLink(true),
      nga.field('type', 'choice').label('类型').choices([{
        value: 'channel_ondemand_temp_only',
        label: '直播付费的点播专辑'
      }, {
        value: 'channel_ondemand',
        label: '整个点播专辑'
      }, {
        value: 'channel_ondemand_partial',
        label: '部分点播专辑'
      }, {
        value: 'channel_live',
        label: '直播流'
      }, {
        value: 'program',
        label: '单个节目'
      }, {
        value: 'category',
        label: '整个频道'
      }, {
        value: 'all',
        label: 'VIP会员'
      }]),
      nga.field('entity_id').label('所属内容ID'),
      nga.field('disabled', 'boolean').label('禁用')
    ];
    var purchase_entity_listItems = purchase_entities_contentItems.concat([id_field.editable(false)]);

    purchase_entity.listView().title('付费收听项目 列表').fields(purchase_entity_listItems).filters([nga.field('entity_id').label('内容ID')]).perPage(10);
    purchase_entity.creationView().title('新建 付费收听项目').fields(purchase_entity.listView().fields().concat([
      nga.field('image').label('项目配图URL'),
      nga.field('details', 'text').label('套餐说明'),
      nga.field('description').label('付费推荐语'),
      nga.field('parent', 'reference').targetEntity(purchase_entity).targetField(nga.field('name')).label('父项目'),
      nga.field('properties', 'json').label('类型专属属性')
    ]));
    purchase_entity.editionView().title('修改 {{ entry.values.name }}').fields(purchase_entity.creationView().fields().concat([
      nga.field('purchase_items', 'referenced_list')
      .targetEntity(purchase_item)
      .targetReferenceField('purchase_entity_id')
      .targetFields([
        nga.field('name').label('名称').isDetailLink(true),
        nga.field('duration').label('收费时长'),
        nga.field('fee', 'float').label('价格').format('$0.00')
      ])
      .label('套餐配置'),
      nga.field('purchase_entities', 'referenced_list')
      .targetEntity(purchase_entity)
      .targetReferenceField('parent')
      .targetFields([
        nga.field('name').label('名称').isDetailLink(true),
        nga.field('entity_id').label('内容ID')
      ])
      .label('子项目')
    ]));
    // purchase_entity.showView().title('{{ entry.values.name }} 详情').fields(purchase_entity.editionView().fields());

    // Purchase Items
    var purchase_entity_field = nga.field('purchase_entity_id', 'reference').targetEntity(purchase_entity).targetField(nga.field('name')).label('付费项目');
    var purchase_item_content_fields = [
      purchase_entity_field,
      nga.field('name').label('名称').isDetailLink(true),
      nga.field('disabled', 'boolean').label('禁用'),
      nga.field('duration').label('收费时长'),
      nga.field('original_fee', 'float').label('原价').format('$0.00'),
      nga.field('fee', 'float').label('价格').format('$0.00'),
      id_field.editable(false).isDetailLink(false)
    ];
    purchase_item.listView().title('付费套餐 列表').fields(purchase_item_content_fields).filters([purchase_entity_field]).perPage(10);
    purchase_item.creationView().title('新建 付费套餐').fields(purchase_item_content_fields);
    purchase_item.editionView().title('修改 {{ entry.values.name }}').fields(purchase_item_content_fields);
    // purchase_item.showView().title('{{ entry.values.name }} 详情').fields(purchase_item.editionView().fields());

    admin.addEntity(purchase_entity);
    admin.addEntity(purchase_item);

    // Order Entity, view only
    var order = nga.entity('orders').label('历史账单');

    var order_type_field = nga.field('type').label('类型').template('<img ng-src="/images/{{value}}.png" style="width:1.2em" />'),
      order_state_field = nga.field('state', 'choice').choices([{
        label: "有效",
        value: "active"
      }, {
        label: "过期",
        value: "expired"
      }, {
        label: "下单",
        value: "ordered"
      }, {
        label: "未知",
        value: "unknown"
      }, {
        label: "准有效",
        value: "semi-active"
      }, {
        label: "接近过期",
        value: "expiring"
      }]).label('状态').editable(false),
      order_time_field = nga.field('order_time').label('下单时间').isDetailLink(true),
      order_fee_field = nga.field('fee', 'float').label('交易额').format('$0.00').editable(false),
      order_id_field = nga.field('id').label('内部交易号').editable(false);

    var order_filterItems = [
      order_state_field,
      nga.field('entity_id').label('主内容ID').editable(false),
      nga.field('purchase_item_id', 'reference').targetEntity(purchase_item).targetField(nga.field('name')).label('套餐').editable(false),
    ];

    order.listView().title('历史账单 列表').fields([
      order_time_field,
      order_fee_field,
      order_type_field,
      nga.field('user.username').label('用户名'),
    ].concat(order_filterItems)).filters([
      nga.field('user_id').label('用户ID'),
      nga.field('start_time', 'date').label('在此之后的订单'),
      nga.field('end_time', 'date').label('在此之前的订单')
    ].concat(order_filterItems)).perPage(30);

    order.editionView().title('{{ entry.values.id }} 详情').fields([
      nga.field('trade_id').label('外部交易号').editable(false),
      order_state_field,
      order_fee_field,
      order_type_field,

      nga.field('order_time').label('下单时间'),
      nga.field('paid_time').label('付款时间'),
      nga.field('expire_time').label('过期时间'),

      nga.field('user_id').label('用户ID').editable(false),
      nga.field('user.username').label('用户名'),

      nga.field('purchase_item_id', 'reference').targetEntity(purchase_item).targetField(nga.field('id')).label('套餐').editable(false),
      nga.field('entity_id').label('主内容'),
      nga.field('entity_ids').label('所有内容ID'),
      nga.field('caster_ids').label('主播ID'),

      nga.field('prepay_data', 'json').label('预付数据（客户端发请求用）'),
      nga.field('response_data', 'json').label('异步回调数据'),
      nga.field('confirm_data', 'json').label('同步回调数据（客户端提交）')
    ]);

    admin.addEntity(order);

    // Awards
    var award = nga.entity('awards').label('打赏历史').identifier(nga.field('id'));
    var awardStateField = nga.field('state', 'choice').choices([{
      label: "有效",
      value: "active"
    }, {
      label: "过期",
      value: "expired"
    }, {
      label: "未付",
      value: "unpaid"
    }, {
      label: "未知",
      value: "unknown"
    }]).label('状态').editable(false)
    award.listView().fields([
      nga.field('id').label('ID').isDetailLink(true).editable(false),
      order_type_field,
      awardStateField,
      nga.field('user.username').label('用户'),
      nga.field('caster.nick_name').label('主播'),
      nga.field('fee', 'float').label('金额').format('$0.00'),
      nga.field('paid_time', 'datetime').label('打赏时间')
    ]).perPage(20).filters([
      nga.field('user_id').label('用户ID'),
      nga.field('caster_id').label('主播ID'),
      nga.field('start_time', 'date').label('在此之后的打赏'),
      nga.field('end_time', 'date').label('在此之前的打赏')
    ]);
    award.editionView().fields(award.listView().fields().concat([
      nga.field('user_id').label('用户ID').editable(false),
      nga.field('caster_id').label('主播ID').editable(false),
      nga.field('order_time', 'datetime').label('下单时间'),
      nga.field('expire_time', 'datetime').label('过期时间'),
      nga.field('trade_id').label('外部交易号').editable(false),
      nga.field('prepay_data', 'json').label('预付数据（客户端发请求用）'),
      nga.field('response_data', 'json').label('异步回调数据'),
      nga.field('confirm_data', 'json').label('同步回调数据（客户端提交）')
    ]));
    admin.addEntity(award);

    // Award statistics
    var awardStat = nga.entity('awardstats').label('打赏统计');
    awardStat.listView().fields([
      nga.field('caster_id').label('主播ID').isDetailLink(true),
      nga.field('total_fee', 'float').label('总打赏金额').format('$0.00'),
      nga.field('total_awards', 'number').label('总打赏次数')
    ]).filters([nga.field('caster_id').label('主播ID')]);
    awardStat.editionView().fields(awardStat.listView().fields().concat([
      nga.field('id').label('ID').editable(false),
      nga.field('top_awards_limit', 'number').label('排行榜人数'),
      nga.field('top_awards', 'embedded_list').label('排行榜').targetFields([
        nga.field('fee').label('钱数'),
        nga.field('user_id').label('用户ID')
      ]),
      nga.field('entry_stats', 'json').label('入口统计'),
      nga.field('daily_awards', 'json').label('日统计')

    ]));
    admin.addEntity(awardStat);

    // Redpacks
    var redpackItem = nga.entity('items').baseApiUrl('/redpacks/').label('红包项目');
    redpackItem.listView().fields([
      nga.field('act_name').label('活动名称').isDetailLink(true),
      nga.field('send_name').label('发送者'),
      nga.field('total_amount', 'float').label('金额')
    ]);
    redpackItem.creationView().fields(redpackItem.listView().fields().concat([
      nga.field('wishing').label('祝福语'),
      nga.field('remark').label('备注'),
    ]));
    redpackItem.editionView().fields(redpackItem.creationView().fields().concat([
      nga.field('id').label('ID').editable(false)
    ]));
    admin.addEntity(redpackItem);

    var redpack = nga.entity('redpacks').label('红包');
    redpack.listView().fields([
      nga.field('openid').label('微信用户ID').isDetailLink(true),
      nga.field('send_time', 'datetime').label('发放时间'),
      nga.field('send_listid').label('微信账单号'),
      nga.field('item_id', 'reference').targetEntity(redpackItem).targetField(nga.field('act_name')).label('项目')
    ]);
    redpack.editionView().fields(redpack.listView().fields().concat([
      nga.field('comment').label('备注'),
      nga.field('mch_billno').label('账单号'),
      nga.field('prepay_data', 'json').label('预付数据'),
      nga.field('response_data', 'json').label('回复数据'),
    ]));    
    admin.addEntity(redpack);

    // Accounts
    var account = nga.entity('accounts').label('主播账户').identifier(nga.field('caster_id'));
    account.listView().fields([
      nga.field('caster_id').label('主播ID').isDetailLink(true),
      nga.field('balance', 'float').label('余额').format('$0.00'),
      nga.field('total', 'float').label('累计总额').format('$0.00'),
      nga.field('pending', 'float').label('待处理').format('$0.00'),
      nga.field('lastUpdate.order', 'datetime').label('付费内容结算时间'),
      nga.field('lastUpdate.award', 'datetime').label('打赏结算时间'),
    ]).filters([nga.field('caster_id').label('主播ID')]);
    account.editionView().fields(account.listView().fields().concat([
      nga.field('awardRoyalty.enabled', 'boolean').label('打赏分成开关'),
      nga.field('awardRoyalty.ratio', 'float').label('打赏分成比例'),
      nga.field('orderRoyalty.enabled', 'boolean').label('付费内容分成开关'),
      nga.field('orderRoyalty.ratio', 'float').label('付费内容分成比例'),
    ]));
    admin.addEntity(account);

    // Pass users, or internal users
    var passUser = nga.entity('p_users').label('内测用户');
    passUser.listView().fields([
      nga.field('user_id').label('用户系统ID').isDetailLink(true),
      nga.field('comment').label('备注'),
      nga.field('scope').label('范围')
    ]).title('内测用户 列表');
    passUser.creationView().title('新建 内测用户').fields(passUser.listView().fields());
    passUser.editionView().title('修改 {{ entry.values.name }}').fields(passUser.listView().fields());

    admin.addEntity(passUser);
    
    var tickets = nga.entity('tickets').label('蜻蜓券').identifier(nga.field('use_code'));
    tickets.listView().fields([
      nga.field('types', 'choice').choices([{
        value: 'voucher',
        label: '代金券'
      }, {
        value: 'item',
        label: '节目券'
      }]).label('类型'),
      nga.field('use_code').label('兑换码').isDetailLink(true),
      nga.field('state', 'choice').choices([{
        value: 'disable',
        label: '被禁用'
      }, {
        value: 'active',
        label: '未被使用'
      }, {
        value: 'pending',
        label: '提交中'
      }, {
        value: 'used',
        label: '已使用'
      }, {
        value: 'expire',
        label: '过期'
      }
      ]).label('状态'),
      nga.field('expire_time').label('过期时间'),
      nga.field('name').label('备注')
    ]).title('蜻蜓券 列表');

    tickets.creationView().fields([
      nga.field('type', 'choice').choices([{
        value: 'voucher',
        label: '代金券'
      }, {
        value: 'item',
        label: '节目券'
      }]).label('类型'),
      nga.field('number', 'number').label('数量'),
      nga.field('info', 'number').label('金额'),
      nga.field('info', 'reference')
        .targetEntity(purchase_item)
        .targetField(nga.field('name'))
        .label('套餐ID')
    ]).title('生成 蜻蜓券');

    tickets.editionView().title('{{entry.values.use_code}}')
    .fields([
      nga.field('use_code').label('兑换码').editable(false),
      nga.field('disable', 'boolean').label('禁用').validation({required: true}),
      nga.field('expire_time').label('过期时间').validation({required: true}),
      nga.field('used_time').label('使用时间').editable(false),
      nga.field('used_by').label('订单号').editable(false)
    ]);
    admin.addEntity(tickets);
     
    // Customize Dashboard
    admin.dashboard(nga.dashboard()
      .addCollection(nga.collection(order)
        .name('orders')
        .title('历史账单')
        .perPage(20) // limit the panel to the 10 latest posts
        .fields([
          order_time_field,
          order_type_field,
          order_state_field,
          order_fee_field
        ])
      ).addCollection(nga.collection(award)
        .name('awards')
        .title('打赏历史')
        .perPage(10)
        .fields([
          nga.field('user.username').label('用户'),
          nga.field('caster.nick_name').label('主播'),
          nga.field('fee', 'float').label('金额').format('$0.00'),
          nga.field('paid_time', 'datetime').label('打赏时间')
        ])
      ).addCollection(nga.collection(awardStat)
        .name('awardStats')
        .title('打赏统计')
        .perPage(10)
        .fields(awardStat.listView().fields())
      ).addCollection(nga.collection(account)
        .name('accounts')
        .title('主播账户')
        .perPage(10)
        .fields(account.listView().fields())
      ));

    var customHeaderTemplate =
      '<div class="navbar-header">' +
      '<a class="navbar-brand" href="#" ng-click="appController.displayHome()">' +
      '蜻蜓FM支付管理系统' +
      '</a>' +
      '</div>' +
      '<p class="navbar-text navbar-right">' +
      (document.username ?
        '<span>' + document.username + '</span> <a href="/admin/chpwd">修改密码</a> <a href="/admin/logout">注销</a>' :
        '<a href="/admin/login">登录</a>') +
      '</p>';
    admin.header(customHeaderTemplate);

    // attach the admin application to the DOM and execute it
    nga.configure(admin);
  }
]);
